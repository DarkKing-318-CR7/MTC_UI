import { useEffect, useRef, useState } from "react";
import type { ErrorData } from "hls.js";

import axiosInstance from "../../../api/axiosInstance";
import { authStorage } from "../../../utils/authStorage";

import "./AuthenticatedHlsPlayer.css";

interface AuthenticatedHlsPlayerProps {
  mediaId: string;
  mediaType: "audio" | "video";
  approvalStatus: string;
  processingStatus: string;
  playbackUrl?: string | null;
  fillContainer?: boolean;
}

function resolvePlaybackUrl(playbackUrl: string): string {
  const apiBase = axiosInstance.defaults.baseURL || window.location.origin;
  const base = apiBase.startsWith("/")
    ? new URL(apiBase, window.location.origin).toString()
    : apiBase;
  return new URL(playbackUrl, base).toString();
}

export function isValidHlsPlaybackUrl(playbackUrl: string | null | undefined, mediaId: string): boolean {
  if (!playbackUrl) return false;
  try {
    const apiBase = axiosInstance.defaults.baseURL || window.location.origin;
    const base = new URL(apiBase, window.location.origin);
    const url = new URL(playbackUrl, base);
    return url.origin === base.origin &&
      url.pathname === `/api/media/${encodeURIComponent(mediaId)}/hls/index.m3u8`;
  } catch {
    return false;
  }
}

export function attachCurrentBearerToken(xhr: XMLHttpRequest): void {
  const token = authStorage.getAccessToken();
  if (token) xhr.setRequestHeader("Authorization", `Bearer ${token}`);
}

function normalizeApprovalStatus(status: string): string {
  return status.trim().toLocaleLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/đ/g, "d");
}

function getUnavailableMessage(status: string, approvalStatus: string, approved: boolean): string {
  const normalizedApproval = normalizeApprovalStatus(approvalStatus);
  if (normalizedApproval.includes("tu choi") || normalizedApproval === "rejected") {
    return "This Media was rejected and cannot be previewed.";
  }
  if (normalizedApproval.includes("cho duyet") || normalizedApproval === "pending") {
    return "This Media is pending approval and cannot be previewed.";
  }
  if (!approved) return "Playback is available only after this Media is approved.";
  switch (status.toLowerCase()) {
    case "pending":
      return "HLS processing is queued.";
    case "processing":
      return "HLS processing is in progress.";
    case "failed":
      return "HLS processing failed. The original Media is still stored.";
    case "notrequired":
      return "HLS playback is not required for this Media.";
    default:
      return "The protected HLS playback URL is not available.";
  }
}

function AuthenticatedHlsPlayer({
  mediaId,
  mediaType,
  approvalStatus,
  processingStatus,
  playbackUrl,
  fillContainer = false,
}: AuthenticatedHlsPlayerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const audioRef = useRef<HTMLAudioElement>(null);
  const [message, setMessage] = useState("");
  const [manifestLoaded, setManifestLoaded] = useState(false);
  const [authRetry, setAuthRetry] = useState(0);
  const [unsupported, setUnsupported] = useState(false);

  const normalizedApproval = normalizeApprovalStatus(approvalStatus);
  const approved = normalizedApproval === "approved" || normalizedApproval === "da duyet";
  const ready = processingStatus.toLowerCase() === "ready";
  const validPlaybackUrl = isValidHlsPlaybackUrl(playbackUrl, mediaId);
  const canPlayHls = approved && ready && validPlaybackUrl;

  useEffect(() => {
    setMessage("");
    setManifestLoaded(false);
    setUnsupported(false);

    if (!canPlayHls || !playbackUrl) return;

    const mediaElement = mediaType === "audio" ? audioRef.current : videoRef.current;
    if (!mediaElement) return;

    if (!authStorage.getAccessToken()) {
      setMessage("Your session has expired. Sign in again to play this Media.");
      return;
    }

    let disposed = false;
    let authRecoveryStarted = false;
    let mediaRecoveryUsed = false;
    let hls: import("hls.js").default | null = null;
    const url = resolvePlaybackUrl(playbackUrl);
    const handleElementError = () => {
      if (!disposed) setMessage("The browser could not decode this media stream.");
    };
    mediaElement.addEventListener("error", handleElementError);

    void import("hls.js")
      .then(({ default: Hls }) => {
        if (disposed) return;
        if (!Hls.isSupported()) {
          const supportsNativeHls = Boolean(
            mediaElement.canPlayType("application/vnd.apple.mpegurl") ||
              mediaElement.canPlayType("application/x-mpegURL"),
          );
          setMessage(
            supportsNativeHls
              ? "This browser's native HLS player cannot send the required Bearer token. Use Chrome or Edge for protected playback."
              : "This browser does not support Media Source Extensions required for protected HLS playback.",
          );
          setUnsupported(true);
          return;
        }

        const player = new Hls({
          xhrSetup: (xhr) => attachCurrentBearerToken(xhr),
        });
        hls = player;

        const handleManifestParsed = () => {
          if (!disposed) {
            setManifestLoaded(true);
            setMessage("");
          }
        };

        const handleError = (_event: string, data: ErrorData) => {
          if (disposed) return;
          const status = data.response?.code;

          if (status === 401) {
            if (authRecoveryStarted) return;
            authRecoveryStarted = true;
            const expiredToken = authStorage.getAccessToken();
            setMessage("Refreshing your session to continue playback…");
            void axiosInstance
              .get(url, { responseType: "text" })
              .then(() => {
                if (!disposed && authStorage.getAccessToken() !== expiredToken) {
                  setAuthRetry((attempt) => attempt + 1);
                } else if (!disposed) {
                  setMessage("Your session could not be renewed. Sign in again to play this Media.");
                }
              })
              .catch(() => {
                if (!disposed) setMessage("Your session expired or this Media is not accessible. Sign in and try again.");
              });
            return;
          }

          if (status === 403) {
            setMessage("Your account or facility does not have access to this Media.");
            return;
          }
          if (status === 404) {
            setMessage("The HLS playlist or a media segment could not be found.");
            return;
          }

          if (data.fatal && data.type === Hls.ErrorTypes.MEDIA_ERROR && !mediaRecoveryUsed) {
            mediaRecoveryUsed = true;
            setMessage("Recovering from a media decoding error…");
            player.recoverMediaError();
            return;
          }

          if (data.fatal) {
            setMessage(
              data.details.toLowerCase().includes("manifest")
                ? "The HLS playlist is invalid or could not be parsed."
                : "Playback failed while loading or decoding the protected HLS stream.",
            );
          }
        };

        const handleMediaAttached = () => player.loadSource(url);
        player.on(Hls.Events.MANIFEST_PARSED, handleManifestParsed);
        player.on(Hls.Events.ERROR, handleError);
        player.on(Hls.Events.MEDIA_ATTACHED, handleMediaAttached);
        player.attachMedia(mediaElement);
      })
      .catch(() => {
        if (!disposed) setMessage("The protected HLS player could not be loaded.");
      });

    return () => {
      disposed = true;
      mediaElement.removeEventListener("error", handleElementError);
      hls?.destroy();
      mediaElement.pause();
      mediaElement.removeAttribute("src");
      mediaElement.load();
    };
  }, [authRetry, canPlayHls, mediaId, mediaType, playbackUrl]);

  if (!canPlayHls) {
    return (
      <div className="authenticated-hls-player__message" role="status">
        {getUnavailableMessage(processingStatus, approvalStatus, approved)}
      </div>
    );
  }

  if (unsupported) {
    return (
      <div className="authenticated-hls-player__message" role="status">
        {message}
      </div>
    );
  }

  return (
    <div className={`authenticated-hls-player${fillContainer ? " authenticated-hls-player--fill" : ""}`}>
      {mediaType === "audio" ? (
        <audio ref={audioRef} controls preload="metadata" />
      ) : (
        <video ref={videoRef} controls preload="metadata" playsInline />
      )}
      {!manifestLoaded && !message && (
        <div className="authenticated-hls-player__message" role="status">
          Loading protected HLS stream…
        </div>
      )}
      {message && (
        <div className="authenticated-hls-player__message" role="alert">
          {message}
        </div>
      )}
    </div>
  );
}

export default AuthenticatedHlsPlayer;
