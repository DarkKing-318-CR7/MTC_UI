import type { MediaApiItem } from "../../../../api/mediaApi";
import type { MediaCategoryApiItem } from "../../../../api/mediaCategoryApi";
import { getUploadChunkRanges } from "../../../../api/mediaApi";
import { mapApprovalStatus, mapMediaItem } from "./sourceMediaApiMapper";

const category: MediaCategoryApiItem = {
  id: "category-guid",
  categoryName: "News",
  description: null,
  isDefault: false,
  organizationId: "org-guid",
  createdAt: "2026-01-01T00:00:00Z",
  updatedAt: null,
};

const media: MediaApiItem = {
  id: "media-guid",
  mediaName: "Morning bulletin",
  fileName: "bulletin.mp4",
  fileType: "Video",
  sourceType: 0,
  fileSize: 5 * 1024 * 1024,
  durationSeconds: 61,
  hlsProcessingStatus: "Pending",
  hlsPlaybackUrl: "/api/media/media-guid/hls/index.m3u8",
  approvedBy: null,
  approvedByName: null,
  approvedAt: null,
  rejectedBy: null,
  rejectedByName: null,
  rejectedAt: null,
  approvalStatus: "Chờ duyệt",
  rejectionReason: null,
  url: null,
  sourceUrl: null,
  frequencyHz: null,
  categoryId: category.id,
  organizationId: "org-guid",
  facilityId: "facility-guid",
  createdBy: "user-guid",
  createdByName: "Creator Name",
  createdAt: "2026-01-01T00:00:00Z",
  updatedAt: null,
  sharedFacilityNames: [],
};

describe("Source Media API mapping", () => {
  it("maps backend IDs, GUID category, approval and HLS state without using the HLS path as a media URL", () => {
    const mapped = mapMediaItem(media, [category]);
    expect(mapped.id).toBe(media.id);
    expect(mapped.categoryId).toBe(category.id);
    expect(mapped.category).toBe(category.categoryName);
    expect(mapped.status).toBe("pending");
    expect(mapped.hlsProcessingStatus).toBe("Pending");
    expect(mapped.hlsPlaybackUrl).toBe(media.hlsPlaybackUrl);
    expect(mapped.createdBy).toBe("Creator Name");
    expect(mapped.createdBy).not.toBe(media.createdBy);
    expect(mapped.url).toBeUndefined();
  });

  it("maps backend approval states", () => {
    expect(mapApprovalStatus("Đã duyệt")).toBe("approved");
    expect(mapApprovalStatus("Từ chối duyệt")).toBe("rejected");
  });

  it("recognizes real backend Vietnamese approval values", () => {
    expect(mapApprovalStatus("Đã duyệt")).toBe("approved");
    expect(mapApprovalStatus("Chờ duyệt")).toBe("pending");
    expect(mapApprovalStatus("Từ chối duyệt")).toBe("rejected");
  });

  it("maps review names and real shared destination names instead of GUIDs", () => {
    const mapped = mapMediaItem(
      {
        ...media,
        approvalStatus: "Approved",
        approvedBy: "approver-guid",
        approvedByName: "Approver Name",
        approvedAt: "2026-01-02T03:04:05Z",
        sharedFacilityNames: ["Child Facility"],
      },
      [category],
    );

    expect(mapped.status).toBe("approved");
    expect(mapped.createdBy).toBe("Creator Name");
    expect(mapped.approvedBy).toBe("Approver Name");
    expect(mapped.approvedAt).toBe("2026-01-02T03:04:05Z");
    expect(mapped.sharedArea).toBe("Child Facility");
  });
});

describe("Chunk range calculation", () => {
  it("splits bytes into zero-based, contiguous, end-exclusive chunks", () => {
    expect(getUploadChunkRanges(5, 2)).toEqual([
      { index: 0, start: 0, end: 2 },
      { index: 1, start: 2, end: 4 },
      { index: 2, start: 4, end: 5 },
    ]);
  });

  it("rejects invalid file and chunk sizes", () => {
    expect(() => getUploadChunkRanges(0, 2)).toThrow();
    expect(() => getUploadChunkRanges(5, 0)).toThrow();
  });
});
