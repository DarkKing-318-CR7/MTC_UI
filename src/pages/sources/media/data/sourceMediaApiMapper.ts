import type { MediaApiItem } from "../../../../api/mediaApi";
import type { MediaCategoryApiItem } from "../../../../api/mediaCategoryApi";
import type { SourceMediaContentType, SourceMediaItem } from "../types/sourceMedia.types";

export function mapApprovalStatus(status: string): SourceMediaItem["status"] {
  switch (status.toLowerCase()) {
    case "đã duyệt":
    case "approved":
      return "approved";
    case "chờ duyệt":
    case "pending":
      return "pending";
    case "từ chối":
    case "từ chối duyệt":
    case "rejected":
      return "rejected";
    default:
      return "processing";
  }
}

export function mapMediaItem(
  media: MediaApiItem,
  categories: MediaCategoryApiItem[],
): SourceMediaItem {
  const type = media.fileType.toLowerCase();
  const mediaType: SourceMediaItem["type"] =
    type === "image" ? "image" : type === "audio" || type === "frequency" ? "audio" : "video";
  const contentType: SourceMediaContentType =
    media.sourceType === 1
      ? "url"
      : media.sourceType === 2
        ? "live"
        : media.sourceType === 3
          ? "frequency"
          : "file";
  const category = categories.find((item) => item.id === media.categoryId);
  const sizeMB = media.fileSize / (1024 * 1024);
  const seconds = media.durationSeconds;

  return {
    id: media.id,
    title: media.mediaName,
    category: category?.categoryName ?? media.categoryId ?? "",
    categoryId: media.categoryId,
    facilityId: media.facilityId,
    organizationId: media.organizationId,
    type: mediaType,
    status: mapApprovalStatus(media.approvalStatus),
    createdAt: media.createdAt,
    createdBy: media.createdByName ?? "",
    sizeMB,
    thumbnail: "",
    fileName: media.fileName,
    fileType: media.fileType,
    sourceType: media.sourceType,
    contentType,
    duration: seconds > 0
      ? `${String(Math.floor(seconds / 3600)).padStart(2, "0")}:${String(Math.floor((seconds % 3600) / 60)).padStart(2, "0")}:${String(seconds % 60).padStart(2, "0")}`
      : "",
    detailSizeLabel: `${sizeMB.toFixed(2)} MB`,
    attachmentOrLink: media.fileName || media.sourceUrl || media.url || "",
    approvedBy: media.approvedByName ?? "",
    approvedAt: media.approvedAt,
    sharedArea: media.sharedFacilityNames?.join(", ") ?? "",
    sharedFacilityNames: media.sharedFacilityNames ?? [],
    rejectionReason: media.rejectionReason ?? undefined,
    resolutions: [],
    sourceUrl: media.sourceUrl,
    url: media.url ?? undefined,
    frequencyHz: media.frequencyHz,
    hlsProcessingStatus: media.hlsProcessingStatus,
    hlsPlaybackUrl: media.hlsPlaybackUrl,
  };
}

export function getChunkCount(fileSize: number, chunkSize: number): number {
  if (!Number.isSafeInteger(fileSize) || fileSize < 0) {
    throw new Error("File size must be a non-negative safe integer.");
  }
  if (!Number.isSafeInteger(chunkSize) || chunkSize <= 0) {
    throw new Error("Chunk size must be a positive safe integer.");
  }
  return Math.ceil(fileSize / chunkSize);
}
