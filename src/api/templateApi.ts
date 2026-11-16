import axiosInstance from "./axiosInstance";
import type { ApiResponse } from "../types/api.types";

export interface TemplateZoneApiItem {
  id: string;
  zoneName: string;
  x: number;
  y: number;
  widthPercent: number;
  heightPercent: number;
  zIndex: number;
  allowedMediaTypes: string;
}

export interface TemplateApiItem {
  id: string;
  organizationId: string;
  facilityId: string;
  templateName: string;
  description: string | null;
  width: number;
  height: number;
  layoutConfigJson: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string | null;
  createdByName: string | null;
  zones: TemplateZoneApiItem[];
}

export interface TemplateZoneUpsertRequest {
  id?: string;
  zoneName: string;
  x: number;
  y: number;
  widthPercent: number;
  heightPercent: number;
  zIndex: number;
  allowedMediaTypes: string;
}

export interface TemplateUpsertRequest {
  organizationId: string;
  facilityId: string;
  templateName: string;
  description: string | null;
  width: number;
  height: number;
  layoutConfigJson: string | null;
  isActive: boolean;
  zones: TemplateZoneUpsertRequest[];
}

function unwrap<T>(response: ApiResponse<T>): T {
  if (!response.success || response.data == null) {
    throw new Error(response.message || "The template request failed.");
  }
  return response.data;
}

export const templateApi = {
  getAll: async (organizationId: string, facilityId?: string): Promise<TemplateApiItem[]> => {
    const response = await axiosInstance.get<ApiResponse<TemplateApiItem[]>>("/templates", {
      params: { organizationId, ...(facilityId ? { facilityId } : {}) },
    });
    return unwrap(response.data);
  },

  getById: async (id: string): Promise<TemplateApiItem> => {
    const response = await axiosInstance.get<ApiResponse<TemplateApiItem>>(
      `/templates/${encodeURIComponent(id)}`,
    );
    return unwrap(response.data);
  },

  create: async (request: TemplateUpsertRequest): Promise<TemplateApiItem> => {
    const response = await axiosInstance.post<ApiResponse<TemplateApiItem>>(
      "/templates",
      request,
    );
    return unwrap(response.data);
  },

  update: async (id: string, request: TemplateUpsertRequest): Promise<TemplateApiItem> => {
    const response = await axiosInstance.put<ApiResponse<TemplateApiItem>>(
      `/templates/${encodeURIComponent(id)}`,
      request,
    );
    return unwrap(response.data);
  },

  delete: async (id: string): Promise<void> => {
    const response = await axiosInstance.delete<ApiResponse<unknown>>(
      `/templates/${encodeURIComponent(id)}`,
    );
    if (!response.data.success) {
      throw new Error(response.data.message || "The template request failed.");
    }
  },
};
