import type { AxiosAdapter, InternalAxiosRequestConfig } from "axios";
import axiosInstance from "./axiosInstance";
import mediaApi from "./mediaApi";

let sentConfig: InternalAxiosRequestConfig | undefined;
const originalAdapter = axiosInstance.defaults.adapter;

describe("mediaApi.uploadChunk", () => {
  beforeEach(() => {
    sentConfig = undefined;
    axiosInstance.defaults.adapter = ((config) => {
      sentConfig = config;
      return Promise.resolve({
        data: { receivedChunks: 1 },
        status: 200,
        statusText: "OK",
        headers: {},
        config,
      });
    }) as AxiosAdapter;
  });

  afterEach(() => {
    axiosInstance.defaults.adapter = originalAdapter;
  });

  it("sends the binary chunk directly in the Chunk FormData field", async () => {
    const chunk = new Blob([new Uint8Array([0, 1, 2, 255])], {
      type: "application/octet-stream",
    });

    await mediaApi.uploadChunk("upload-id", 0, chunk);

    expect(sentConfig?.url).toBe("/media-uploads/upload-id/chunks/0");
    expect(sentConfig?.data).toBeInstanceOf(FormData);
    expect((sentConfig?.data as FormData).get("Chunk")).toMatchObject({
      size: chunk.size,
    });
    expect(sentConfig?.headers.get("Content-Type")).toBe("multipart/form-data");
    expect(sentConfig?.onUploadProgress).toEqual(expect.any(Function));
  });
});
