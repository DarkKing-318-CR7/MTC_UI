export type TemplateSourceType = "video" | "audio" | "image";

export interface TemplateSource {
  id: string;
  name: string;
  type: TemplateSourceType;
  thumbnail: string;
  url: string;
  resolution?: string[];
  createdBy?: string;
  createdAt?: string;
  approvalStatus?: string;
  hlsProcessingStatus?: string;
  hlsPlaybackUrl?: string | null;
}

export interface TemplateLayer {
  id: string;
  sourceId: string;
  zoneId?: string;
  zoneName?: string;
  allowedMediaTypes?: string;
  x: number;
  y: number;
  width: number;
  height: number;
  zIndex: number;
  hasAudio?: boolean;
}

export interface TemplateFormData {
  name: string;
  screenWidth: number | null;
  screenHeight: number | null;
  duration: string;
  layers: TemplateLayer[];
  organizationId?: string;
  facilityId?: string;
  description?: string | null;
  layoutConfigJson?: string | null;
  isActive?: boolean;
  createdByName?: string | null;
}

export type TemplateFormMode = "create" | "edit" | "view";

export interface StoredFacilityTemplate extends TemplateFormData {
  id: string;
  facilityId: string;
  name: string;
  screenWidth: number | null;
  screenHeight: number | null;
  aspectRatio: string;
  createdAt: string;
  createdBy: string;
  isUsed?: boolean;
}
