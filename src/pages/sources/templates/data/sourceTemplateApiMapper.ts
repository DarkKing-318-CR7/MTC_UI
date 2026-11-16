import type { TemplateFormData, TemplateLayer, TemplateSource } from "../../../../types/template.types";
import type { TemplateApiItem, TemplateUpsertRequest } from "../../../../api/templateApi";
import type { MediaApiItem } from "../../../../api/mediaApi";

export interface SourceTemplateListItem {
  id: string;
  name: string;
  aspectRatio: string;
  width: number;
  height: number;
  createdAt: string;
  createdBy: string;
  isActive: boolean;
}

function mediaType(fileType: string): TemplateSource["type"] | null {
  const normalized = fileType.trim().toLowerCase();
  if (normalized === "video") return "video";
  if (normalized === "audio") return "audio";
  if (normalized === "image") return "image";
  return null;
}

function isApprovedStatus(status: string): boolean {
  const normalized = status.trim().toLocaleLowerCase().normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "").replace(/đ/g, "d");
  return normalized === "da duyet" || normalized === "approved";
}

export function mapEligibleTemplateSources(media: MediaApiItem[]): TemplateSource[] {
  return media.flatMap((item) => {
    const type = mediaType(item.fileType);
    // Backend MediaSourceMethod: File=0, UrlDownload=1, StreamUrl=2, FrequencyChannel=3.
    const supportedSource = item.sourceType === 0 || item.sourceType === 1;
    const approved = isApprovedStatus(item.approvalStatus);
    if (!type || !supportedSource || !approved) return [];

    return [{
      id: item.id,
      name: item.mediaName,
      type,
      thumbnail: "",
      url: "",
      createdBy: item.createdByName ?? undefined,
      createdAt: item.createdAt,
      approvalStatus: item.approvalStatus,
      hlsProcessingStatus: item.hlsProcessingStatus,
      hlsPlaybackUrl: item.hlsPlaybackUrl,
    }];
  });
}

export function mapTemplateListItem(item: TemplateApiItem): SourceTemplateListItem {
  return {
    id: item.id,
    name: item.templateName,
    aspectRatio: `${item.width} x ${item.height}`,
    width: item.width,
    height: item.height,
    createdAt: item.createdAt,
    createdBy: item.createdByName?.trim() || "\u2014",
    isActive: item.isActive,
  };
}

export function mapTemplateToForm(item: TemplateApiItem): TemplateFormData {
  const layers: TemplateLayer[] = item.zones.map((zone) => ({
    id: zone.id,
    zoneId: zone.id,
    zoneName: zone.zoneName,
    sourceId: "",
    x: zone.x,
    y: zone.y,
    width: Number(zone.widthPercent),
    height: Number(zone.heightPercent),
    zIndex: zone.zIndex,
    allowedMediaTypes: zone.allowedMediaTypes,
    hasAudio: true,
  }));

  return {
    name: item.templateName,
    screenWidth: item.width,
    screenHeight: item.height,
    duration: "00:00:00",
    layers,
    organizationId: item.organizationId,
    facilityId: item.facilityId,
    description: item.description,
    layoutConfigJson: item.layoutConfigJson,
    isActive: item.isActive,
    createdByName: item.createdByName,
  };
}

export function buildTemplateUpsertRequest(
  data: TemplateFormData,
  organizationId: string,
  facilityId: string,
  sources: TemplateSource[],
): TemplateUpsertRequest {
  if (!data.name.trim()) throw new Error("Template name is required.");
  const width = Number(data.screenWidth);
  const height = Number(data.screenHeight);
  if (!Number.isInteger(width) || width <= 0 || !Number.isInteger(height) || height <= 0) {
    throw new Error("Screen width and height must be positive whole numbers.");
  }

  const zones = data.layers.map((layer, index) => {
    if (!Number.isInteger(layer.x) || layer.x < 0 || !Number.isInteger(layer.y) || layer.y < 0) {
      throw new Error("Zone coordinates must be non-negative whole numbers.");
    }
    if (!Number.isFinite(layer.width) || layer.width <= 0 || layer.width > 100 ||
        !Number.isFinite(layer.height) || layer.height <= 0 || layer.height > 100) {
      throw new Error("Zone dimensions must be greater than 0 and at most 100 percent.");
    }
    if (!Number.isInteger(layer.zIndex) || layer.zIndex < 0) {
      throw new Error("Zone z-index must be a non-negative whole number.");
    }

    const selectedSource = sources.find((source) => source.id === layer.sourceId);
    const allowedMediaTypes = layer.allowedMediaTypes ?? (selectedSource
      ? selectedSource.type[0].toUpperCase() + selectedSource.type.slice(1)
      : "");
    if (!allowedMediaTypes) {
      throw new Error("Each zone must retain an allowed media type.");
    }
    const zoneName = layer.zoneName?.trim() || `Zone ${index + 1}`;
    if (zoneName.length > 100) throw new Error("Zone names cannot exceed 100 characters.");
    const allowedTypes = allowedMediaTypes.split(",").map((type) => type.trim().toLowerCase());
    if (allowedTypes.some((type) => !["video", "audio", "image", "url"].includes(type))) {
      throw new Error("Zones support only Video, Audio, Image, or URL media types.");
    }

    return {
      ...(layer.zoneId ? { id: layer.zoneId } : {}),
      zoneName,
      x: layer.x,
      y: layer.y,
      widthPercent: layer.width,
      heightPercent: layer.height,
      zIndex: layer.zIndex,
      allowedMediaTypes,
    };
  });

  return {
    organizationId,
    facilityId,
    templateName: data.name.trim(),
    description: data.description ?? null,
    width,
    height,
    layoutConfigJson: data.layoutConfigJson ?? null,
    isActive: data.isActive ?? true,
    zones,
  };
}
