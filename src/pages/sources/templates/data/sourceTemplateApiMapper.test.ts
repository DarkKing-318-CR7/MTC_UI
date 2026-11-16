import type { MediaApiItem } from "../../../../api/mediaApi";
import type { TemplateApiItem } from "../../../../api/templateApi";
import { buildTemplateUpsertRequest, mapEligibleTemplateSources, mapTemplateListItem, mapTemplateToForm } from "./sourceTemplateApiMapper";

const template: TemplateApiItem = {
  id: "template-id", organizationId: "org-id", facilityId: "facility-id",
  templateName: "Layout", description: null, width: 1920, height: 1080,
  layoutConfigJson: null, isActive: true, createdAt: "2026-01-01T00:00:00Z", updatedAt: null,
  createdByName: null,
  zones: [{ id: "zone-id", zoneName: "Main", x: 10, y: 20, widthPercent: 50, heightPercent: 75, zIndex: 2, allowedMediaTypes: "Video,Image" }],
};

const media = (overrides: Partial<MediaApiItem>): MediaApiItem => ({
  id: "media-id", mediaName: "Approved video", fileName: "video.mp4", fileType: "Video",
  sourceType: 0, fileSize: 1, durationSeconds: 1, hlsProcessingStatus: "Ready",
  hlsPlaybackUrl: null, approvalStatus: "Đã duyệt", rejectionReason: null,
  approvedBy: null, approvedByName: null, approvedAt: null, rejectedBy: null,
  rejectedByName: null, rejectedAt: null, url: null, sourceUrl: null, frequencyHz: null,
  categoryId: null, organizationId: "org-id", facilityId: "facility-id", createdBy: null,
  createdByName: null, createdAt: "2026-01-01T00:00:00Z", updatedAt: null,
  sharedFacilityNames: [], ...overrides,
});

describe("source template API mapping", () => {
  it("maps the creator full name and uses an em dash when the API has no creator name", () => {
    expect(mapTemplateListItem({ ...template, createdByName: "Nguyễn Minh An" }).createdBy).toBe("Nguyễn Minh An");
    expect(mapTemplateListItem({ ...template, createdByName: null }).createdBy).toBe("\u2014");
    expect(mapTemplateToForm({ ...template, createdByName: "Nguyễn Minh An" }).createdByName).toBe("Nguyễn Minh An");
    expect(mapTemplateToForm({ ...template, createdByName: null }).createdByName).toBeNull();
  });

  it("only presents approved supported media and excludes stream and frequency sources", () => {
    expect(mapEligibleTemplateSources([
      media({}),
      media({ id: "pending", approvalStatus: "Chờ duyệt" }),
      media({ id: "stream", sourceType: 2 }),
      media({ id: "frequency", sourceType: 3, fileType: "Frequency" }),
    ]).map((source) => source.id)).toEqual(["media-id"]);
  });

  it("retains the API HLS and approval state needed by temporary canvas previews", () => {
    const [source] = mapEligibleTemplateSources([media({})]);
    expect(source).toMatchObject({
      id: "media-id",
      approvalStatus: "\u0110\u00e3 duy\u1ec7t",
      hlsProcessingStatus: "Ready",
      hlsPlaybackUrl: null,
    });
  });

  it("restores zone geometry and IDs and serializes height and width without swapping", () => {
    const form = mapTemplateToForm(template);
    const payload = buildTemplateUpsertRequest(form, "org-id", "facility-id", []);
    expect(payload.width).toBe(1920);
    expect(payload.height).toBe(1080);
    expect(payload.zones).toEqual([{
      id: "zone-id", zoneName: "Main", x: 10, y: 20,
      widthPercent: 50, heightPercent: 75, zIndex: 2, allowedMediaTypes: "Video,Image",
    }]);
  });

  it("maps a newly selected media source to a supported allowed type without persisting its MediaId", () => {
    const form = mapTemplateToForm(template);
    form.layers = [{ id: "new-layer", sourceId: "media-id", x: 0, y: 0, width: 100, height: 100, zIndex: 0 }];
    const payload = buildTemplateUpsertRequest(form, "org-id", "facility-id", [
      {
        id: "media-id", name: "Approved video", type: "video", thumbnail: "", url: "",
        approvalStatus: "Đã duyệt", hlsProcessingStatus: "Ready",
        hlsPlaybackUrl: "/api/media/media-id/hls/index.m3u8",
      },
    ]);
    expect(payload.zones[0]).toMatchObject({ zoneName: "Zone 1", allowedMediaTypes: "Video" });
    expect(payload.zones[0]).not.toHaveProperty("mediaId");
  });

  it("rejects invalid zone coordinates, dimensions, and z-index", () => {
    const form = mapTemplateToForm(template);
    form.layers[0].x = -1;
    expect(() => buildTemplateUpsertRequest(form, "org-id", "facility-id", [])).toThrow("Zone coordinates");

    form.layers[0].x = 0;
    form.layers[0].height = 101;
    expect(() => buildTemplateUpsertRequest(form, "org-id", "facility-id", [])).toThrow("Zone dimensions");

    form.layers[0].height = 75;
    form.layers[0].zIndex = -1;
    expect(() => buildTemplateUpsertRequest(form, "org-id", "facility-id", [])).toThrow("z-index");
  });
});
