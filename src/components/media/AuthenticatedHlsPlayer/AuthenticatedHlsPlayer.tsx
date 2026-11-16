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
}

function resolvePlaybackUrl(playbackUrl: string): string {
  const apiBase = axiosInstance.defaults.baseURL || window.location.origin;
  const base = apiBase.startsWith("/")
    ? new URL(apiBase, window.location.origin).toString()
    : apiBase;
  return new URL(playbackUrl, base).toString();
}

export function attachCurrentBearerToken(xhr: XMLHttpRequest): void {
  const token = authStorage.getAccessToken();
  if (token) xhr.setRequestHeader("Authorization", `Bearer ${token}`);
}

function getUnavailableMessage(status: string, approved: boolean): string {
  if (!approved) return "Playback is available after this Media is approved.";
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
}: AuthenticatedHlsPlayerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const audioRef = useRef<HTMLAudioElement>(null);
  const [message, setMessage] = useState("");
  const [manifestLoaded, setManifestLoaded] = useState(false);
  const [authRetry, setAuthRetry] = useState(0);
  const [unsupported, setUnsupported] = useState(false);

  const approved = approvalStatus.toLowerCase() === "approved" || approvalStatus.includes("Đã duyệt");
  const ready = processingStatus.toLowerCase() === "ready";
  const canPlayHls = approved && ready && Boolean(playbackUrl);

  useEffect(() => {
    setMessage("");
    setManifestLoaded(false);

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
        {getUnavailableMessage(processingStatus, approved)}
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
    <div className="authenticated-hls-player">
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
