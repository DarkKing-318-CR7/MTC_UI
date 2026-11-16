import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { readFileSync } from "fs";
import { join } from "path";

import axiosInstance from "../../../api/axiosInstance";
import type { MediaItem } from "../../../types/media.types";
import MediaPreview from "./MediaPreview";

const originalCreateObjectUrl = Object.getOwnPropertyDescriptor(URL, "createObjectURL");
const originalRevokeObjectUrl = Object.getOwnPropertyDescriptor(URL, "revokeObjectURL");

jest.mock("../../../api/axiosInstance", () => ({
  __esModule: true,
  default: { get: jest.fn() },
}));

jest.mock("../AuthenticatedHlsPlayer/AuthenticatedHlsPlayer", () => ({
  __esModule: true,
  default: ({ mediaId, mediaType, processingStatus, playbackUrl }: {
    mediaId: string;
    mediaType: string;
    processingStatus: string;
    playbackUrl?: string | null;
  }) => (
    <div data-testid="authenticated-hls-player" data-media-id={mediaId}
      data-media-type={mediaType} data-processing-status={processingStatus}
      data-playback-url={playbackUrl ?? ""} />
  ),
}));

const getMedia = axiosInstance.get as jest.Mock;
const baseMedia: MediaItem = {
  id: "media-1",
  title: "Sample media",
  category: "News",
  type: "image",
  status: "approved",
  createdAt: "2026-01-01T00:00:00Z",
  createdBy: "Creator",
  sizeMB: 1,
  thumbnail: "",
};

function createMedia(overrides: Record<string, unknown> = {}) {
  return {
    ...baseMedia,
    fileName: "sample.jpg",
    fileType: "Image",
    sourceType: 0,
    hlsProcessingStatus: "NotRequired",
    hlsPlaybackUrl: null,
    ...overrides,
  };
}

describe("MediaPreview authenticated original playback", () => {
  beforeEach(() => {
    getMedia.mockReset();
    getMedia.mockResolvedValue({ data: new Blob(["media"], { type: "image/jpeg" }) });
    Object.defineProperty(URL, "createObjectURL", { configurable: true, value: jest.fn(() => "blob:media-preview") });
    Object.defineProperty(URL, "revokeObjectURL", { configurable: true, value: jest.fn() });
  });

  afterAll(() => {
    if (originalCreateObjectUrl) Object.defineProperty(URL, "createObjectURL", originalCreateObjectUrl);
    else Reflect.deleteProperty(URL, "createObjectURL");
    if (originalRevokeObjectUrl) Object.defineProperty(URL, "revokeObjectURL", originalRevokeObjectUrl);
    else Reflect.deleteProperty(URL, "revokeObjectURL");
  });

  it.each(["sample.jpg", "sample.jpeg", "sample.png"])(
    "fetches uploaded %s through the authenticated stream and renders an image",
    async (fileName) => {
      getMedia.mockResolvedValue({ data: new Blob(["image"], { type: fileName.endsWith("png") ? "image/png" : "image/jpeg" }) });

      render(<MediaPreview media={createMedia({ fileName }) as MediaItem & ReturnType<typeof createMedia>} onClose={jest.fn()} />);

      await waitFor(() => expect(screen.getByRole("img", { name: "Sample media" })).toHaveAttribute("src", "blob:media-preview"));
      expect(getMedia).toHaveBeenCalledWith("/media/media-1/stream", expect.objectContaining({ responseType: "blob" }));
      expect(screen.queryByTestId("authenticated-hls-player")).not.toBeInTheDocument();
    },
  );

  it.each([
    ["sample.mp3", "audio/mpeg"],
    ["sample.wav", "audio/wav"],
  ])("plays uploaded %s from an authenticated Blob, not HLS", async (fileName, contentType) => {
    getMedia.mockResolvedValue({ data: new Blob(["audio"], { type: contentType }) });

    render(<MediaPreview media={createMedia({
      fileName,
      fileType: "Audio",
      type: "audio",
      hlsProcessingStatus: "Ready",
      hlsPlaybackUrl: "/api/media/media-1/hls/index.m3u8",
    }) as MediaItem & ReturnType<typeof createMedia>} onClose={jest.fn()} />);

    await waitFor(() => expect(screen.getByLabelText("Sample media")).toHaveAttribute("src", "blob:media-preview"));
    expect(getMedia).toHaveBeenCalledWith("/media/media-1/stream", expect.objectContaining({ responseType: "blob" }));
    expect(screen.queryByTestId("authenticated-hls-player")).not.toBeInTheDocument();
  });

  it("preserves the authenticated HLS player for uploaded MP4 video", () => {
    render(<MediaPreview media={createMedia({
      fileName: "sample.mp4",
      fileType: "Video",
      type: "video",
      hlsProcessingStatus: "Ready",
      hlsPlaybackUrl: "/api/media/media-1/hls/index.m3u8",
    }) as MediaItem & ReturnType<typeof createMedia>} onClose={jest.fn()} />);

    expect(screen.getByTestId("authenticated-hls-player")).toHaveAttribute("data-media-type", "video");
    expect(screen.getByTestId("authenticated-hls-player")).toHaveAttribute("data-playback-url", "/api/media/media-1/hls/index.m3u8");
    expect(getMedia).not.toHaveBeenCalled();
  });

  it("shows a useful authorization fallback when the stream is forbidden", async () => {
    getMedia.mockRejectedValue({ isAxiosError: true, response: { status: 403 } });

    render(<MediaPreview media={createMedia()} onClose={jest.fn()} />);

    expect(await screen.findByText("Your account or facility cannot access this file.")).toBeInTheDocument();
  });

  it("releases the previous Blob URL when the selected Media changes and on unmount", async () => {
    getMedia.mockResolvedValue({ data: new Blob(["image"], { type: "image/jpeg" }) });
    const onClose = jest.fn();
    const { rerender, unmount } = render(<MediaPreview media={createMedia()} onClose={onClose} />);
    await screen.findByRole("img", { name: "Sample media" });

    rerender(<MediaPreview media={createMedia({ id: "media-2", title: "Next media" })} onClose={onClose} />);
    await screen.findByRole("img", { name: "Next media" });
    expect(URL.revokeObjectURL).toHaveBeenCalledWith("blob:media-preview");
    expect(getMedia).toHaveBeenLastCalledWith("/media/media-2/stream", expect.objectContaining({ responseType: "blob" }));

    unmount();
    expect(URL.revokeObjectURL).toHaveBeenCalledTimes(2);
  });

  it("keeps the close control accessible and isolates the information section for scrolling", async () => {
    const onClose = jest.fn();
    const style = document.createElement("style");
    style.textContent = readFileSync(join(__dirname, "MediaPreview.css"), "utf8");
    document.head.appendChild(style);
    const { unmount } = render(<MediaPreview media={createMedia({ contentValue: "x".repeat(3000) }) as MediaItem & ReturnType<typeof createMedia>} onClose={onClose} />);
    await screen.findByRole("img", { name: "Sample media" });

    fireEvent.click(screen.getByRole("button", { name: "Đóng xem nhanh Media" }));
    expect(onClose).toHaveBeenCalledTimes(1);
    const panel = document.querySelector<HTMLElement>(".media-preview");
    const details = document.querySelector<HTMLElement>(".media-preview__details");
    const close = screen.getByRole("button", { name: "Đóng xem nhanh Media" });
    const value = document.querySelector<HTMLElement>(".media-preview__link");
    expect(panel).not.toBeNull();
    expect(details).not.toBeNull();
    expect(getComputedStyle(panel!).maxHeight).toBe("100%");
    expect(getComputedStyle(details!).minHeight).toBe("0");
    expect(getComputedStyle(details!).overflowY).toBe("auto");
    expect(getComputedStyle(close).position).toBe("absolute");
    expect(getComputedStyle(value!).overflowWrap).toBe("anywhere");
    unmount();
    style.remove();
  });
});
