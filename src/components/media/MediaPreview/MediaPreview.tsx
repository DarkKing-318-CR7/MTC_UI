import { useState } from "react";
import { FolderRoot, Play, X } from "lucide-react";

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
            {media.sourceType === 0 && (isVideo || isAudio) && media.hlsProcessingStatus ? (
              <AuthenticatedHlsPlayer
                mediaId={media.id}
                mediaType={isAudio ? "audio" : "video"}
                approvalStatus={media.status}
                processingStatus={media.hlsProcessingStatus}
                playbackUrl={media.hlsPlaybackUrl}
              />
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

            {(isVideo || isAudio) && !(media.sourceType === 0 && media.hlsProcessingStatus) && (
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
