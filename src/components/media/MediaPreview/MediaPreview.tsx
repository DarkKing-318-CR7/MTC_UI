import { useEffect, useState } from "react";
import { FolderRoot, Play, X } from "lucide-react";

import axios from "axios";
import axiosInstance from "../../../api/axiosInstance";
import type { MediaItem } from "../../../types/media.types";
import AuthenticatedHlsPlayer from "../AuthenticatedHlsPlayer/AuthenticatedHlsPlayer";

import "./MediaPreview.css";

export interface MediaPreviewItem extends MediaItem {
  durationSeconds?: number | null;
  contentValue?: string | null;
  fileName?: string | null;
  approvedBy?: string | null;
  sharedLocations?: string | null;
  hlsProcessingStatus?: string;
  hlsPlaybackUrl?: string | null;
  sourceType?: number;
  approvedAt?: string | null;
}

interface MediaPreviewProps<T extends MediaPreviewItem> {
  media: T;
  onClose: () => void;
}

type OriginalPreviewKind = "image" | "audio" | "video";

function AuthenticatedOriginalPreview({
  mediaId,
  title,
  kind,
}: {
  mediaId: string;
  title: string;
  kind: OriginalPreviewKind;
}) {
  const [objectUrl, setObjectUrl] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [playbackError, setPlaybackError] = useState<string | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    let active = true;
    let createdUrl: string | null = null;
    setObjectUrl(null);
    setErrorMessage(null);
    setPlaybackError(null);

    void axiosInstance.get<Blob>(`/media/${encodeURIComponent(mediaId)}/stream`, {
      responseType: "blob",
      signal: controller.signal,
    }).then((response) => {
      if (!active) return;
      createdUrl = URL.createObjectURL(response.data);
      setObjectUrl(createdUrl);
    }).catch((error: unknown) => {
      if (!active) return;
      if (axios.isAxiosError(error) && error.response?.status === 401) {
        setErrorMessage("Your session expired. Sign in to preview this file.");
      } else if (axios.isAxiosError(error) && error.response?.status === 403) {
        setErrorMessage("Your account or facility cannot access this file.");
      } else if (axios.isAxiosError(error) && error.response?.status === 404) {
        setErrorMessage("The original media file is unavailable.");
      } else {
        setErrorMessage("Unable to load the authenticated media preview.");
      }
    });

    return () => {
      active = false;
      controller.abort();
      if (createdUrl) URL.revokeObjectURL(createdUrl);
    };
  }, [mediaId]);

  if (errorMessage) {
    return <div className="media-preview__placeholder" role="status">{errorMessage}</div>;
  }
  if (playbackError) {
    return <div className="media-preview__placeholder" role="status">{playbackError}</div>;
  }
  if (!objectUrl) {
    return <div className="media-preview__placeholder" role="status">Loading media preview…</div>;
  }
  if (kind === "image") return <img src={objectUrl} alt={title} onError={() => setPlaybackError("The original image could not be displayed.")} />;
  if (kind === "audio") return <audio src={objectUrl} controls preload="metadata" aria-label={title} onError={() => setPlaybackError("The original audio file could not be played.")} />;
  return <video src={objectUrl} controls preload="metadata" playsInline aria-label={title} onError={() => setPlaybackError("The original video file could not be played.")} />;
}

const statusConfig = {
  approved: {
    label: "Đã duyệt",
    className: "approved",
  },
  pending: {
    label: "Chờ duyệt",
    className: "pending",
  },
  rejected: {
    label: "Từ chối duyệt",
    className: "rejected",
  },
  processing: {
    label: "Đang xử lý",
    className: "processing",
  },
} as const;

function formatDate(value?: string) {
  if (!value) return "—";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return "—";

  return date.toLocaleString("vi-VN", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });
}

function formatDuration(seconds?: number | null) {
  if (seconds == null || seconds < 0) return "—";

  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const remainingSeconds = Math.floor(seconds % 60);

  const parts = [minutes, remainingSeconds];

  if (hours > 0) {
    parts.unshift(hours);
  }

  return parts.map((part) => String(part).padStart(2, "0")).join(":");
}

function MediaPreview<T extends MediaPreviewItem>({
  media,
  onClose,
}: MediaPreviewProps<T>) {
  const [failedThumbnail, setFailedThumbnail] = useState("");

  const status = statusConfig[media.status];

  const isVideo = media.type === "video";
  const isAudio = media.type === "audio";
  const isImage = media.type === "image";
  const isUploadedFile = media.sourceType === 0;
  const fileExtension = (media.fileName ?? "").toLowerCase().match(/\.[^.]+$/)?.[0] ?? "";
  const isSupportedAudioFile = fileExtension === ".mp3" || fileExtension === ".wav";
  const useHlsVideo = isUploadedFile && isVideo && Boolean(media.hlsProcessingStatus) &&
    media.hlsProcessingStatus?.toLowerCase() !== "notrequired";
  const useAuthenticatedImage = isUploadedFile && isImage;
  const useAuthenticatedAudio = isUploadedFile && isAudio && isSupportedAudioFile;
  const useAuthenticatedVideo = isUploadedFile && isVideo && !useHlsVideo;

  const thumbnail =
    media.thumbnail || (isImage ? media.sourceUrl || media.url || "" : "");

  const showThumbnail = Boolean(thumbnail) && failedThumbnail !== thumbnail;

  const source = media.sourceUrl || media.url || "";

  const typeLabel = isVideo ? "VIDEO" : isAudio ? "AUDIO" : "IMAGE";

  const qualityOptions = ["4K", "2K", "FHD", "HD"];

  const contentDisplay =
    media.contentValue || media.fileName || media.sourceUrl || media.url || "—";

  return (
    <aside className="media-preview">
      <button
        type="button"
        className="media-preview__close"
        onClick={onClose}
        aria-label="Đóng xem nhanh Media">
        <X size={24} />
      </button>

      <div className="media-preview__top">
        <div className="media-preview__main">
          <div className="media-preview__thumbnail">
            {useAuthenticatedImage ? (
              <AuthenticatedOriginalPreview key={media.id} mediaId={media.id} title={media.title} kind="image" />
            ) : useHlsVideo ? (
              <AuthenticatedHlsPlayer
                mediaId={media.id}
                mediaType="video"
                approvalStatus={media.status}
                processingStatus={media.hlsProcessingStatus ?? "Pending"}
                playbackUrl={media.hlsPlaybackUrl}
              />
            ) : useAuthenticatedAudio ? (
              <AuthenticatedOriginalPreview key={media.id} mediaId={media.id} title={media.title} kind="audio" />
            ) : useAuthenticatedVideo ? (
              <AuthenticatedOriginalPreview key={media.id} mediaId={media.id} title={media.title} kind="video" />
            ) : showThumbnail ? (
              <img
                key={thumbnail}
                src={thumbnail}
                alt={media.title}
                onError={() => setFailedThumbnail(thumbnail)}
              />
            ) : (
              <div className="media-preview__placeholder">
                Không có ảnh xem trước
              </div>
            )}

            {(isVideo || isAudio) && !useHlsVideo && !useAuthenticatedAudio && !useAuthenticatedVideo && (
              <button
                type="button"
                className="media-preview__play"
                aria-label={`Phát ${media.title}`}
                disabled={!source}
                onClick={() => {
                  if (source) {
                    window.open(source, "_blank", "noopener,noreferrer");
                  }
                }}>
                <Play size={18} fill="currentColor" />
              </button>
            )}

            <div className="media-preview__badges">
              <span>{typeLabel}</span>

              {media.durationSeconds != null && (
                <span>{formatDuration(media.durationSeconds)}</span>
              )}

              <span>{media.sizeMB}MB</span>
            </div>
          </div>

          <h3 className="media-preview__title">{media.title}</h3>

          <div className="media-preview__quality">
            <div className="media-preview__quality-list">
              <span className="media-preview__quality-original">
                <FolderRoot size={16} />
                <span>4K</span>
              </span>

              {qualityOptions.slice(1).map((quality) => (
                <span key={quality} className="media-preview__quality-tag">
                  {quality}
                </span>
              ))}
            </div>

            <span
              className={[
                "media-preview__status",
                `media-preview__status--${status.className}`,
              ].join(" ")}>
              <span className="media-preview__status-dot" />
              {status.label}
            </span>
          </div>

          {media.status === "processing" && (
            <p className="media-preview__processing">
              Đang tiến hành xử lý các phiên bản
            </p>
          )}
        </div>
      </div>

      <div className="media-preview__divider" />

      <div className="media-preview__details">
        {media.approvedAt && (
          <div className="media-preview__field">
            <span className="media-preview__label">Approval time:</span>
            <span className="media-preview__value">{formatDate(media.approvedAt)}</span>
          </div>
        )}
        <div className="media-preview__field">
          <span className="media-preview__label">Lĩnh vực:</span>
          <span className="media-preview__value">{media.category || "—"}</span>
        </div>

        <div className="media-preview__field">
          <span className="media-preview__label">
            File đính kèm hoặc link nội dung:
          </span>
          <span className="media-preview__value media-preview__link">
            {contentDisplay}
          </span>
        </div>

        <div className="media-preview__field">
          <span className="media-preview__label">Người phê duyệt:</span>
          <span className="media-preview__value">
            {media.approvedBy || "—"}
          </span>
        </div>

        <div className="media-preview__field">
          <span className="media-preview__label">Người tạo:</span>
          <span className="media-preview__value">{media.createdBy || "—"}</span>
        </div>

        <div className="media-preview__field">
          <span className="media-preview__label">Ngày tạo:</span>
          <span className="media-preview__value">
            {formatDate(media.createdAt)}
          </span>
        </div>

        <div className="media-preview__field">
          <span className="media-preview__label">Địa bàn chia sẻ:</span>
          <span className="media-preview__value">
            {media.sharedLocations || "—"}
          </span>
        </div>
      </div>
    </aside>
  );
}

export default MediaPreview;
