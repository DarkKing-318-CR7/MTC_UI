import axiosInstance from "./axiosInstance";
import type { ApiResponse } from "../types/api.types";

export interface MediaApiItem {
  id: string;
  mediaName: string;
  fileName: string;
  fileType: string;
  sourceType: number;
  fileSize: number;
  durationSeconds: number;
  hlsProcessingStatus: string;
  hlsPlaybackUrl: string | null;
  approvalStatus: string;
  rejectionReason: string | null;
  approvedBy: string | null;
  approvedByName: string | null;
  approvedAt: string | null;
  rejectedBy: string | null;
  rejectedByName: string | null;
  rejectedAt: string | null;
  url: string | null;
  sourceUrl: string | null;
  frequencyHz: number | null;
  categoryId: string | null;
  organizationId: string;
  facilityId: string;
  createdBy: string | null;
  createdByName: string | null;
  createdAt: string;
  updatedAt: string | null;
  sharedFacilityNames: string[];
}
export interface CreateMediaRequest {
  mediaName: string;
  fileType: string;
  sourceType: number;
  facilityId: string;
  sourceUrl?: string | null;
  url?: string | null;
  frequencyHz?: number | null;
  categoryId?: string | null;
}
export interface UpdateMediaRequest {
  mediaName: string;
  fileType: string;
  sourceType: number;
  facilityId: string;
  sourceUrl?: string | null;
  url?: string | null;
  frequencyHz?: number | null;
  categoryId?: string | null;
}
//Chưa có xóa
export interface RejectMediaRequest {
  rejectionReason: string;
}

export interface InitializeMediaUploadRequest {
  fileName: string;
  mediaName: string;
  fileSize: number;
  organizationId: string;
  facilityId: string;
  categoryId?: string | null;
}

export interface InitializeMediaUploadResponse {
  uploadIdentifier: string;
  chunkSize: number;
  totalChunks: number;
  expiresAt: string;
}

export interface MediaUploadStatus {
  uploadIdentifier: string;
  status: string;
  receivedChunks: number;
  totalChunks: number;
  progressPercentage: number;
  expiresAt: string | null;
  failureReason: string | null;
  mediaId: string | null;
}

export interface CompleteMediaUploadResponse {
  mediaId: string;
  status: string;
  fileSize: number;
  checksumMd5: string;
  checksumSha256: string;
}

export interface UploadProgress {
  loaded: number;
  total?: number;
}

export function getUploadChunkRanges(fileSize: number, chunkSize: number) {
  if (!Number.isSafeInteger(fileSize) || fileSize < 1) {
    throw new Error("File size must be a positive safe integer.");
  }
  if (!Number.isSafeInteger(chunkSize) || chunkSize < 1) {
    throw new Error("Chunk size must be a positive safe integer.");
  }
  const ranges: Array<{ index: number; start: number; end: number }> = [];
  for (let start = 0, index = 0; start < fileSize; start += chunkSize, index += 1) {
    ranges.push({ index, start, end: Math.min(start + chunkSize, fileSize) });
  }
  return ranges;
}
type MediaListResponse = ApiResponse<MediaApiItem[]>;
type MediaDetailResponse = ApiResponse<MediaApiItem>;

const checkResult = <T>(result: ApiResponse<T>): T => {
  if (!result.success) {
    throw new Error(result.message || "Không thể tải dữ liệu Media");
  }

  return result.data;
};

const mediaApi = {
  getAll: async (): Promise<MediaApiItem[]> => {
    const response = await axiosInstance.get<MediaListResponse>("/media");
    return checkResult(response.data);
  },

  getById: async (id: string): Promise<MediaApiItem> => {
    const response = await axiosInstance.get<MediaDetailResponse>(
      `/media/${encodeURIComponent(id)}`,
    );

    return checkResult(response.data);
  },
  create: async (data: CreateMediaRequest): Promise<MediaApiItem> => {
    const response = await axiosInstance.post<ApiResponse<MediaApiItem>>(
      "/media",
      data,
    );

    return checkResult(response.data);
  },
  update: async (
    id: string,
    data: UpdateMediaRequest,
  ): Promise<MediaApiItem> => {
    const response = await axiosInstance.put<ApiResponse<MediaApiItem>>(
      `/media/${encodeURIComponent(id)}`,
      data,
    );

    return checkResult(response.data);
  },
  approve: async (id: string): Promise<MediaApiItem> => {
    const response = await axiosInstance.post<ApiResponse<MediaApiItem>>(
      `/media/${encodeURIComponent(id)}/approve`,
    );

    return checkResult(response.data);
  },
  reject: async (
    id: string,
    data: RejectMediaRequest,
  ): Promise<MediaApiItem> => {
    const response = await axiosInstance.post<ApiResponse<MediaApiItem>>(
      `/media/${encodeURIComponent(id)}/reject`,
      data,
    );

    return checkResult(response.data);
  },
  initializeUpload: async (
    payload: InitializeMediaUploadRequest,
  ): Promise<InitializeMediaUploadResponse> => {
    const response = await axiosInstance.post<InitializeMediaUploadResponse>(
      "/media-uploads",
      payload,
    );
    return response.data;
  },
  uploadChunk: async (
    uploadIdentifier: string,
    chunkIndex: number,
    chunk: Blob,
    onUploadProgress?: (progress: UploadProgress) => void,
  ): Promise<MediaUploadStatus> => {
    const body = new FormData();
    body.append("Chunk", chunk, `chunk-${chunkIndex}`);
    const response = await axiosInstance.put<MediaUploadStatus>(
      `/media-uploads/${encodeURIComponent(uploadIdentifier)}/chunks/${chunkIndex}`,
      body,
      {
        onUploadProgress: (event) =>
          onUploadProgress?.({ loaded: event.loaded, total: event.total }),
      },
    );
    return response.data;
  },
  getUploadStatus: async (uploadIdentifier: string): Promise<MediaUploadStatus> => {
    const response = await axiosInstance.get<MediaUploadStatus>(
      `/media-uploads/${encodeURIComponent(uploadIdentifier)}`,
    );
    return response.data;
  },
  completeUpload: async (
    uploadIdentifier: string,
  ): Promise<CompleteMediaUploadResponse> => {
    const response = await axiosInstance.post<CompleteMediaUploadResponse>(
      `/media-uploads/${encodeURIComponent(uploadIdentifier)}/complete`,
    );
    return response.data;
  },
};

export default mediaApi;
