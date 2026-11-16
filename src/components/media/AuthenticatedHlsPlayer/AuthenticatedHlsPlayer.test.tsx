import { render, screen } from "@testing-library/react";

import AuthenticatedHlsPlayer, { attachCurrentBearerToken } from "./AuthenticatedHlsPlayer";

const baseProps = {
  mediaId: "media-id",
  mediaType: "video" as const,
  approvalStatus: "approved",
  processingStatus: "Pending",
  playbackUrl: "/api/media/media-id/hls/index.m3u8",
};

describe("AuthenticatedHlsPlayer eligibility", () => {
  it("does not render a player before HLS processing is ready", () => {
    const { container } = render(<AuthenticatedHlsPlayer {...baseProps} />);

    expect(screen.getByText("HLS processing is queued.")).toBeInTheDocument();
    expect(container.querySelector("video, audio")).toBeNull();
  });

  it("does not render a player until the Media is approved", () => {
    const { container } = render(
      <AuthenticatedHlsPlayer {...baseProps} processingStatus="Ready" approvalStatus="pending" />,
    );

    expect(screen.getByText("Playback is available after this Media is approved.")).toBeInTheDocument();
    expect(container.querySelector("video, audio")).toBeNull();
  });

  it("recognizes the backend's real Vietnamese approved status", () => {
    render(
      <AuthenticatedHlsPlayer
        {...baseProps}
        approvalStatus="Đã duyệt"
        processingStatus="Ready"
      />,
    );

    expect(
      screen.queryByText("Playback is available after this Media is approved."),
    ).not.toBeInTheDocument();
  });
});

describe("HLS request authorization", () => {
  afterEach(() => sessionStorage.removeItem("mtc_access_token"));

  it("attaches the current access token as a Bearer header to HLS XHR requests", () => {
    sessionStorage.setItem("mtc_access_token", "current-access-token");
    const xhr = { setRequestHeader: jest.fn() } as unknown as XMLHttpRequest;

    attachCurrentBearerToken(xhr);

    expect(xhr.setRequestHeader).toHaveBeenCalledWith(
      "Authorization",
      "Bearer current-access-token",
    );
  });

  it("does not create an authorization header without a current access token", () => {
    const xhr = { setRequestHeader: jest.fn() } as unknown as XMLHttpRequest;

    attachCurrentBearerToken(xhr);

    expect(xhr.setRequestHeader).not.toHaveBeenCalled();
  });
});
