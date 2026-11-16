import { useEffect, useState } from "react";

import axiosInstance from "../../../api/axiosInstance";
import AuthenticatedHlsPlayer from "../../media/AuthenticatedHlsPlayer/AuthenticatedHlsPlayer";
import type { TemplateSource } from "../../../types/template.types";

import "./TemplateMediaPreview.css";

interface TemplateMediaPreviewProps {
  source: TemplateSource;
  fillContainer?: boolean;
}

export function isApprovedTemplateMedia(status?: string): boolean {
  const normalized = status?.trim().toLocaleLowerCase().normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "").replace(/đ/g, "d");
  return normalized === "approved" || normalized === "da duyet";
}

function ImageMediaPreview({ source }: { source: TemplateSource }) {
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    let active = true;
    let objectUrl: string | null = null;
    setImageUrl(null);
    setError(null);
    setLoading(true);

    void axiosInstance.get<Blob>(`/media/${encodeURIComponent(source.id)}/stream`, {
      responseType: "blob",
      signal: controller.signal,
    }).then((response) => {
      if (!active) return;
      objectUrl = URL.createObjectURL(response.data);
      setImageUrl(objectUrl);
    }).catch(() => {
      if (active) setError("The authenticated image preview is unavailable.");
    }).finally(() => {
      if (active) setLoading(false);
    });

    return () => {
      active = false;
      controller.abort();
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [source.id]);

  if (loading) return <div className="template-media-preview__message">Loading image preview…</div>;
  if (error || !imageUrl) {
    return <div className="template-media-preview__message" role="status">{error || "Image preview is unavailable."}</div>;
  }
  return <img className="template-media-preview__image" src={imageUrl} alt={source.name} />;
}

function TemplateMediaPreview({ source, fillContainer = false }: TemplateMediaPreviewProps) {
  if (!isApprovedTemplateMedia(source.approvalStatus)) {
    const status = source.approvalStatus?.trim().toLocaleLowerCase().normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "").replace(/đ/g, "d") ?? "";
    const message = status.includes("tu choi") || status === "rejected"
      ? "This Media was rejected and cannot be previewed."
      : status.includes("cho duyet") || status === "pending"
        ? "This Media is pending approval and cannot be previewed."
        : "Preview is available only for approved Media.";
    return <div className="template-media-preview__message" role="status">{message}</div>;
  }

  if (source.type === "image") {
    return <ImageMediaPreview source={source} />;
  }

  return (
    <AuthenticatedHlsPlayer
      mediaId={source.id}
      mediaType={source.type}
      approvalStatus={source.approvalStatus ?? ""}
      processingStatus={source.hlsProcessingStatus ?? "NotRequired"}
      playbackUrl={source.hlsPlaybackUrl}
      fillContainer={fillContainer}
    />
  );
}

export default TemplateMediaPreview;
