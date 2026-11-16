import { render, screen, waitFor } from "@testing-library/react";

import axiosInstance from "../../../api/axiosInstance";
import type { TemplateSource } from "../../../types/template.types";
import TemplatePreview from "./TemplatePreview";

const originalCreateObjectUrl = Object.getOwnPropertyDescriptor(URL, "createObjectURL");
const originalRevokeObjectUrl = Object.getOwnPropertyDescriptor(URL, "revokeObjectURL");

afterEach(() => {
  if (originalCreateObjectUrl) Object.defineProperty(URL, "createObjectURL", originalCreateObjectUrl);
  else Reflect.deleteProperty(URL, "createObjectURL");
  if (originalRevokeObjectUrl) Object.defineProperty(URL, "revokeObjectURL", originalRevokeObjectUrl);
  else Reflect.deleteProperty(URL, "revokeObjectURL");
});

jest.mock("../../../api/axiosInstance", () => ({
  __esModule: true,
  default: { get: jest.fn() },
}));

jest.mock("../../media/AuthenticatedHlsPlayer/AuthenticatedHlsPlayer", () => ({
  __esModule: true,
  default: ({ mediaId, mediaType, approvalStatus, processingStatus, playbackUrl }: {
    mediaId: string;
    mediaType: string;
    approvalStatus: string;
    processingStatus: string;
    playbackUrl?: string | null;
  }) => (
    <div data-testid="authenticated-hls-preview"
      data-media-id={mediaId}
      data-media-type={mediaType}
      data-approval-status={approvalStatus}
      data-processing-status={processingStatus}
      data-playback-url={playbackUrl || ""} />
  ),
}));

const getMedia = axiosInstance.get as jest.Mock;
const baseSource: TemplateSource = {
  id: "media-id",
  name: "Approved media",
  type: "video",
  thumbnail: "",
  url: "",
  approvalStatus: "Đã duyệt",
  hlsProcessingStatus: "Ready",
  hlsPlaybackUrl: "/api/media/media-id/hls/index.m3u8",
};

function renderCanvas(source: TemplateSource, active = true) {
  return render(
    <TemplatePreview
      layers={[{
        id: "zone-id", sourceId: source.id, zoneName: "Zone 1",
        x: 0, y: 0, width: 100, height: 100, zIndex: 1,
      }]}
      sources={[source]}
      activeLayerId="zone-id"
      screenWidth={1920}
      screenHeight={1080}
      onSelect={jest.fn()}
      active={active}
    />,
  );
}

describe("Template canvas media preview", () => {
  beforeEach(() => getMedia.mockReset());

  it("maps a selected video into the authenticated HLS preview with approval and readiness state", () => {
    renderCanvas(baseSource);
    expect(screen.getByTestId("authenticated-hls-preview")).toHaveAttribute("data-media-id", "media-id");
    expect(screen.getByTestId("authenticated-hls-preview")).toHaveAttribute("data-media-type", "video");
    expect(screen.getByTestId("authenticated-hls-preview")).toHaveAttribute("data-processing-status", "Ready");
    expect(screen.getByTestId("authenticated-hls-preview")).toHaveAttribute("data-playback-url", baseSource.hlsPlaybackUrl!);
  });

  it("uses the audio presentation for approved HLS audio", () => {
    renderCanvas({ ...baseSource, id: "audio-id", type: "audio", hlsPlaybackUrl: "/api/media/audio-id/hls/index.m3u8" });
    expect(screen.getByTestId("authenticated-hls-preview")).toHaveAttribute("data-media-type", "audio");
  });

  it("loads image bytes through the authenticated Media stream and releases its object URL when preview closes", async () => {
    const blob = new Blob(["image-bytes"], { type: "image/png" });
    getMedia.mockResolvedValue({ data: blob });
    const createObjectURL = jest.fn().mockReturnValue("blob:template-image");
    const revokeObjectURL = jest.fn();
    Object.defineProperty(URL, "createObjectURL", { configurable: true, value: createObjectURL });
    Object.defineProperty(URL, "revokeObjectURL", { configurable: true, value: revokeObjectURL });

    const { rerender } = renderCanvas({ ...baseSource, type: "image", hlsProcessingStatus: "NotRequired", hlsPlaybackUrl: null });
    await waitFor(() => expect(screen.getByRole("img", { name: "Approved media" })).toHaveAttribute("src", "blob:template-image"));
    expect(getMedia).toHaveBeenCalledWith("/media/media-id/stream", expect.objectContaining({ responseType: "blob" }));

    rerender(
      <TemplatePreview
        layers={[{ id: "zone-id", sourceId: "media-id", zoneName: "Zone 1", x: 0, y: 0, width: 100, height: 100, zIndex: 1 }]}
        sources={[{ ...baseSource, type: "image", hlsProcessingStatus: "NotRequired", hlsPlaybackUrl: null }]}
        activeLayerId="zone-id"
        screenWidth={1920}
        screenHeight={1080}
        onSelect={jest.fn()}
        active={false}
      />,
    );
    expect(revokeObjectURL).toHaveBeenCalledWith("blob:template-image");
  });

  it("does not fetch or render media after the editor preview is suspended for presentation", () => {
    renderCanvas(baseSource, false);
    expect(screen.getByText("Presentation preview is active")).toBeInTheDocument();
    expect(screen.queryByTestId("authenticated-hls-preview")).not.toBeInTheDocument();
    expect(getMedia).not.toHaveBeenCalled();
  });

  it("does not fetch or preview unapproved image media", () => {
    renderCanvas({ ...baseSource, type: "image", approvalStatus: "Chờ duyệt" });
    expect(screen.getByText("This Media is pending approval and cannot be previewed.")).toBeInTheDocument();
    expect(getMedia).not.toHaveBeenCalled();
  });
});
