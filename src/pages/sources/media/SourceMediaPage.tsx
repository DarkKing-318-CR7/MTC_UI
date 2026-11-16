import { useCallback, useEffect, useMemo, useState } from "react";
import { Form, message, Spin } from "antd";
import dayjs from "dayjs";
import {
  FileCheckCorner,
  FileX2,
  Plus,
  RefreshCw,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import AppConfirmModal from "../../../components/common/AppConfirmModal";
import AppDateRangePicker from "../../../components/common/AppDateRangePicker";
import type { DateRangeValue } from "../../../components/common/AppDateRangePicker";
import AppFilter, {
  AppFilterField,
} from "../../../components/common/AppFilter";
import AppIconButton from "../../../components/common/AppIconButton";
import AppPagination from "../../../components/common/AppPagination";
import AppSearch from "../../../components/common/AppSearch";
import AppSelect from "../../../components/common/AppSelect";
import { ROUTES } from "../../../constants/route.constants";
import { useActionPanel } from "../../../contexts/ActionPanelContext";
import { useFacilityContext } from "../../../contexts/FacilityContext";
import { authApi } from "../../../api/authApi";
import mediaApi, { getUploadChunkRanges, type MediaApiItem } from "../../../api/mediaApi";
import mediaCategoryApi, { type MediaCategoryApiItem } from "../../../api/mediaCategoryApi";
import SourceNavigationTabs from "../components/SourceNavigationTabs";
import MediaCard from "../../../components/media/MediaCard/MediaCard";
import MediaFormModal from "../../../components/media/MediaFormModal/MediaFormModal";
import type { MediaFormValues } from "../../../components/media/MediaFormModal/MediaFormModal";
import MediaPreview from "../../../components/media/MediaPreview/MediaPreview";
import MediaRejectModal from "../../../components/media/MediaRejectModal/MediaRejectModal";
import { mapMediaItem } from "./data/sourceMediaApiMapper";
import type { SourceMediaItem } from "./types/sourceMedia.types";
import "./SourceMediaPage.css";
const PAGE_SIZE = 12;
const MEDIA_TYPE_OPTIONS = [
  { label: "Tất cả", value: "all" },
  { label: "Video", value: "video" },
  { label: "Âm thanh", value: "audio" },
  { label: "Hình ảnh", value: "image" },
];
const APPROVAL_STATUS_OPTIONS = [
  { label: "Tất cả", value: "all" },
  { label: "Đã duyệt", value: "approved" },
  { label: "Chờ duyệt", value: "pending" },
  { label: "Đang xử lý", value: "processing" },
  { label: "Từ chối duyệt", value: "rejected" },
];
function parseDurationSeconds(value?: string | null): number | null {
  if (!value) return null;
  const parts = value.split(":").map(Number);
  if (parts.some((part) => !Number.isFinite(part) || part < 0)) return null;
  if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2];
  if (parts.length === 2) return parts[0] * 60 + parts[1];
  return null;
}

function requestErrorMessage(error: unknown, fallback: string): string {
  if (axios.isAxiosError(error)) {
    if (error.response?.status === 403) return "Your role or organization/facility scope does not allow this operation.";
    if (error.response?.status === 409) return "The media state changed on the server. Refresh and try again.";
    const body = error.response?.data as { message?: string; detail?: string } | undefined;
    return body?.message || body?.detail || error.message || fallback;
  }
  return error instanceof Error ? error.message : fallback;
}
function SourceMediaPage() {
  const navigate = useNavigate();
  const [messageApi, contextHolder] = message.useMessage();
  const { setActions } = useActionPanel();
  const { selectedFacilityId, refreshFacilities } = useFacilityContext();
  const [mediaItems, setMediaItems] = useState<SourceMediaItem[]>([]);
  const [categories, setCategories] = useState<MediaCategoryApiItem[]>([]);
  const [organizationId, setOrganizationId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<number | null>(null);
  const [category, setCategory] = useState("all");
  const [mediaType, setMediaType] = useState("all");
  const [approvalStatus, setApprovalStatus] = useState("all");
  const [dateRange, setDateRange] = useState<DateRangeValue>([null, null]);
  const [keyword, setKeyword] = useState("");
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [currentPage, setCurrentPage] = useState(1);
  const [previewMediaId, setPreviewMediaId] = useState<string | null>(null);
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [editingMedia, setEditingMedia] = useState<SourceMediaItem | null>(
    null,
  );
  const [approveModalOpen, setApproveModalOpen] = useState(false);
  const [approvalTargetIds, setApprovalTargetIds] = useState<string[]>([]);
  const [rejectModalOpen, setRejectModalOpen] = useState(false);
  const [rejectionTargetIds, setRejectionTargetIds] = useState<string[]>([]);
  const categoryList = useMemo(() => categories.map((item) => item.categoryName), [categories]);

  const refreshMedia = useCallback(async (categoryRows = categories) => {
    const response = await mediaApi.getAll();
    setMediaItems(response.map((item) => mapMediaItem(item, categoryRows)));
    setLoadError(null);
  }, [categories]);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setLoadError(null);
    void (async () => {
      try {
        const user = await authApi.getMe();
        if (!user.organizationId) throw new Error("Tài khoản hiện tại chưa được gán tổ chức.");
        setOrganizationId(user.organizationId);
        const [categoryRows, mediaRows] = await Promise.all([
          mediaCategoryApi.getAll(),
          mediaApi.getAll(),
          refreshFacilities().catch(() => undefined),
        ]).then(([cats, rows]) => [cats, rows] as const);
        if (!active) return;
        setCategories(categoryRows);
        setMediaItems(mediaRows.map((item: MediaApiItem) => mapMediaItem(item, categoryRows)));
      } catch (error) {
        if (active) setLoadError(requestErrorMessage(error, "Unable to load media."));
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => { active = false; };
  }, [refreshFacilities]);
  const categoryOptions = useMemo(
    () => categories.map((cat) => ({ id: cat.id, name: cat.categoryName })),
    [categories],
  );
  const categoryFilterOptions = useMemo(
    () => [
      { label: "Tất cả", value: "all" },
      ...categories.map((cat) => ({
        label: cat.categoryName,
        value: cat.id,
      })),
    ],
    [categories],
  );
  const filteredMedia = useMemo(() => {
    const search = keyword.trim().toLowerCase();
    const [startDate, endDate] = dateRange;
    return mediaItems.filter((item) => {
      const matchCategory = category === "all" || item.categoryId === category;
      const matchType = mediaType === "all" || item.type === mediaType;
      const matchStatus = approvalStatus === "all" || (
        approvalStatus === "processing"
          ? ["Pending", "Processing"].includes(item.hlsProcessingStatus ?? "")
          : item.status === approvalStatus
      );
      const createdDate = dayjs(item.createdAt);
      const matchDate =
        (!startDate || !createdDate.isBefore(startDate, "day")) &&
        (!endDate || !createdDate.isAfter(endDate, "day"));
      const matchKeyword =
        !search ||
        item.title.toLowerCase().includes(search) ||
        item.fileName.toLowerCase().includes(search) ||
        item.attachmentOrLink.toLowerCase().includes(search) ||
        item.createdBy.toLowerCase().includes(search);
      return (
        matchCategory && matchType && matchStatus && matchDate && matchKeyword
      );
    });
  }, [mediaItems, category, mediaType, approvalStatus, dateRange, keyword]);
  const totalPages = Math.max(1, Math.ceil(filteredMedia.length / PAGE_SIZE));
  const safePage = Math.min(currentPage, totalPages);
  const paginatedMedia = useMemo(() => {
    const start = (safePage - 1) * PAGE_SIZE;
    return filteredMedia.slice(start, start + PAGE_SIZE);
  }, [filteredMedia, safePage]);
  const previewMedia = useMemo(
    () =>
      previewMediaId
        ? (mediaItems.find((item) => item.id === previewMediaId) ?? null)
        : null,
    [mediaItems, previewMediaId],
  );
  const handleOpenAddMedia = useCallback(() => {
    setCreateModalOpen(true);
  }, []);
  const handleOpenApprove = useCallback(() => {
    if (selectedIds.length === 0) {
      messageApi.warning("Vui lòng chọn media file cần phê duyệt");
      return;
    }
    const eligibleIds = selectedIds.filter((id) =>
      mediaItems.some((item) => item.id === id && item.status === "pending"),
    );
    if (eligibleIds.length === 0) {
      messageApi.warning("Chỉ có thể duyệt Media đang chờ duyệt");
      return;
    }
    setApprovalTargetIds(eligibleIds);
    setApproveModalOpen(true);
  }, [selectedIds, mediaItems, messageApi]);
  const handleOpenReject = useCallback(() => {
    if (selectedIds.length === 0) {
      messageApi.warning("Vui lòng chọn media file cần từ chối duyệt");
      return;
    }
    const eligibleIds = selectedIds.filter((id) =>
      mediaItems.some((item) => item.id === id && item.status === "pending"),
    );
    if (eligibleIds.length === 0) {
      messageApi.warning("Chỉ có thể từ chối Media đang chờ duyệt");
      return;
    }
    setRejectionTargetIds(eligibleIds);
    setRejectModalOpen(true);
  }, [selectedIds, mediaItems, messageApi]);
  useEffect(() => {
    setActions([
      {
        key: "add-media",
        icon: <Plus />,
        tooltip: "Thêm file media",
        onClick: handleOpenAddMedia,
      },
      {
        key: "approve-media",
        icon: <FileCheckCorner color="#34CD26" />,
        tooltip: "Duyệt media file",
        onClick: handleOpenApprove,
      },
      {
        key: "reject-media",
        icon: <FileX2 />,
        tooltip: "Từ chối duyệt media",
        danger: true,
        onClick: handleOpenReject,
      },
    ]);
    return () => {
      setActions([]);
    };
  }, [
    setActions,
    handleOpenAddMedia,
    handleOpenApprove,
    handleOpenReject,
  ]);
  const handleResetFilters = () => {
    setCategory("all");
    setMediaType("all");
    setApprovalStatus("all");
    setDateRange([null, null]);
    setKeyword("");
    setCurrentPage(1);
    setLoading(true);
    setLoadError(null);
    void Promise.all([mediaCategoryApi.getAll(), mediaApi.getAll()])
      .then(([categoryRows, mediaRows]) => {
        setCategories(categoryRows);
        setMediaItems(mediaRows.map((item) => mapMediaItem(item, categoryRows)));
      })
      .catch((error: unknown) => setLoadError(requestErrorMessage(error, "Unable to refresh media.")))
      .finally(() => setLoading(false));
  };
  const handleToggleSelect = (id: string, checked: boolean) => {
    setSelectedIds((prev) =>
      checked ? [...new Set([...prev, id])] : prev.filter((x) => x !== id),
    );
  };
  const handleOpenDetail = (media: SourceMediaItem) => {
    navigate(`${ROUTES.SOURCE_MEDIA}/${media.id}`);
  };
  const handleSaveMedia = async (values: MediaFormValues) => {
    const targetFacilityId = editingMedia?.facilityId ?? selectedFacilityId;
    if (!organizationId || !targetFacilityId) {
      throw new Error("Select an organization and facility before saving media.");
    }
    setSaving(true);
    try {
      if (values.contentType === "file" && !editingMedia) {
        const file = values.file;
        if (!file) throw new Error("Choose a file before uploading.");
        const extensions: Record<string, "Image" | "Audio" | "Video"> = {
          ".png": "Image", ".jpg": "Image", ".jpeg": "Image",
          ".mp3": "Audio", ".wav": "Audio", ".mp4": "Video",
        };
        const extension = file.name.slice(file.name.lastIndexOf(".")).toLowerCase();
        if (!extensions[extension]) {
          throw new Error("Backend accepts MP4, MP3, WAV, PNG, JPG, and JPEG files.");
        }
        const session = await mediaApi.initializeUpload({
          fileName: file.name,
          mediaName: values.title,
          fileSize: file.size,
          organizationId,
          facilityId: targetFacilityId,
          categoryId: values.category || null,
        });
        const ranges = getUploadChunkRanges(file.size, session.chunkSize);
        if (ranges.length !== session.totalChunks) {
          throw new Error("Upload session returned an inconsistent chunk count.");
        }
        let uploadedBytes = 0;
        setUploadProgress(0);
        for (const range of ranges) {
          const chunk = file.slice(range.start, range.end);
          await mediaApi.uploadChunk(
            session.uploadIdentifier,
            range.index,
            chunk,
            (progress) => {
              const chunkBytesSent = Math.min(progress.loaded, chunk.size);
              setUploadProgress(
                Math.min(
                  99,
                  Math.floor(((range.start + chunkBytesSent) / file.size) * 100),
                ),
              );
            },
          );
          uploadedBytes += range.end - range.start;
          setUploadProgress(Math.floor((uploadedBytes / file.size) * 100));
        }
        const status = await mediaApi.getUploadStatus(session.uploadIdentifier);
        if (status.receivedChunks !== session.totalChunks || status.status !== "Uploading") {
          throw new Error(status.failureReason || "Backend has not confirmed all upload chunks.");
        }
        const completed = await mediaApi.completeUpload(session.uploadIdentifier);
        if (completed.status !== "Completed" || !completed.mediaId) {
          throw new Error("Backend did not confirm upload completion.");
        }
        const created = await mediaApi.getById(completed.mediaId);
        setMediaItems((items) => [
          mapMediaItem(created, categories),
          ...items.filter((item) => item.id !== created.id),
        ]);
        await refreshMedia(categories).catch(() => {
          messageApi.warning("Upload completed, but the media list could not be refreshed.");
        });
        setCreateModalOpen(false);
        setCurrentPage(1);
        if (values.description) messageApi.warning("Descriptions are not stored by the backend media DTO.");
        messageApi.success("Backend confirmed upload of " + created.mediaName + ".");
      } else {
        const sourceType =
          values.contentType === "url" ? 1 :
          values.contentType === "live" ? 2 :
          values.contentType === "frequency" ? 3 : 0;
        const fileType = values.contentType === "live"
          ? "LiveStream"
          : values.contentType === "frequency"
            ? "Frequency"
            : values.fileType ?? editingMedia?.fileType ?? "";
        const contentValue = values.contentValue?.trim();
        const payload = {
          mediaName: values.title,
          fileType,
          sourceType,
          facilityId: targetFacilityId,
          sourceUrl: sourceType === 1 ? contentValue : null,
          url: sourceType === 2 ? contentValue : null,
          frequencyHz: sourceType === 3 ? Number(contentValue) : null,
          categoryId: values.category || null,
        };
        const saved = editingMedia
          ? await mediaApi.update(editingMedia.id, payload)
          : await mediaApi.create(payload);
        setMediaItems((items) => [
          mapMediaItem(saved, categories),
          ...items.filter((item) => item.id !== saved.id),
        ]);
        await refreshMedia(categories).catch(() => {
          messageApi.warning("The save succeeded, but the media list could not be refreshed.");
        });
        if (editingMedia) setEditingMedia(null);
        else setCreateModalOpen(false);
        if (values.description) {
          messageApi.warning("The backend media DTO does not persist descriptions; the description was not saved.");
        }
        messageApi.success("Backend confirmed save of " + saved.mediaName + ".");
      }
    } catch (error) {
      messageApi.error(requestErrorMessage(error, "Unable to save media."));
      throw error;
    } finally {
      setSaving(false);
      setUploadProgress(null);
    }
  };
  const handleConfirmApprove = async () => {
    if (approvalTargetIds.length === 0) {
      setApproveModalOpen(false);
      return;
    }
    setSaving(true);
    try {
      const results = await Promise.allSettled(approvalTargetIds.map((id) => mediaApi.approve(id)));
      const succeeded = approvalTargetIds.filter((_, index) => results[index].status === "fulfilled");
      await refreshMedia().catch(() => messageApi.warning("Approval requests completed, but the media list could not be refreshed."));
      setSelectedIds((previous) => previous.filter((id) => !succeeded.includes(id)));
      if (succeeded.length === approvalTargetIds.length) {
        messageApi.success("Backend confirmed approval of " + succeeded.length + " media item(s).");
      } else {
        messageApi.error("Backend approved " + succeeded.length + " of " + approvalTargetIds.length + " selected media item(s). Refresh and review the remaining items.");
      }
      setApprovalTargetIds([]);
      setApproveModalOpen(false);
    } catch (error) {
      messageApi.error(requestErrorMessage(error, "Unable to approve media."));
    } finally {
      setSaving(false);
    }
  };
  const handleConfirmReject = async (reason: string) => {
    if (rejectionTargetIds.length === 0) {
      setRejectModalOpen(false);
      return;
    }
    setSaving(true);
    try {
      const results = await Promise.allSettled(rejectionTargetIds.map((id) => mediaApi.reject(id, { rejectionReason: reason })));
      const succeeded = rejectionTargetIds.filter((_, index) => results[index].status === "fulfilled");
      await refreshMedia().catch(() => messageApi.warning("Rejection requests completed, but the media list could not be refreshed."));
      setSelectedIds((previous) => previous.filter((id) => !succeeded.includes(id)));
      if (succeeded.length === rejectionTargetIds.length) {
        messageApi.success("Backend confirmed rejection of " + succeeded.length + " media item(s).");
      } else {
        messageApi.error("Backend rejected " + succeeded.length + " of " + rejectionTargetIds.length + " selected media item(s). Refresh and review the remaining items.");
      }
      setRejectionTargetIds([]);
      setRejectModalOpen(false);
    } catch (error) {
      messageApi.error(requestErrorMessage(error, "Unable to reject media."));
    } finally {
      setSaving(false);
    }
  };
  const handleApproveSingle = (media: SourceMediaItem) => {
    if (media.status !== "pending") return;
    setApprovalTargetIds([media.id]);
    setApproveModalOpen(true);
  };
  const handleRejectSingle = (media: SourceMediaItem) => {
    if (media.status !== "pending") return;
    setRejectionTargetIds([media.id]);
    setRejectModalOpen(true);
  };
  return (
    <div className="source-media-page">
      {contextHolder}
      <SourceNavigationTabs />
      <div className="source-media-page__body">
        <section className="source-media-panel">
          <div className="source-media-panel__header">
            <h2 className="source-media-panel__title">
              Danh sách Media cơ sở đang quản lý
            </h2>
            <div className="source-media-panel__header-actions">
        <button
                type="button"
                className="source-media-panel__storage-btn"
          title="Storage quota is not exposed by the current backend API"
          onClick={() => messageApi.info("Storage quota is not available from the backend yet.")}>
          <span>Dung lượng lưu trữ</span>
              </button>
              <AppIconButton
                icon={<RefreshCw size={20} />}
                tooltip="Làm mới danh sách"
                size={34}
                iconSize={20}
                className="source-media-panel__refresh"
                onClick={handleResetFilters}
              />
            </div>
          </div>

          <div className="source-media-panel__filters">
            <AppFilter showActions={false} gap={12}>
              <AppFilterField width={175}>
                <Form.Item label="Lĩnh vực">
                  <AppSelect
                    width="100%"
                    value={category}
                    options={categoryFilterOptions}
                    onChange={(value) => {
                      setCategory(String(value));
                      setCurrentPage(1);
                    }}
                  />
                </Form.Item>
              </AppFilterField>
              <AppFilterField width={155}>
                <Form.Item label="Loại media">
                  <AppSelect
                    width="100%"
                    value={mediaType}
                    options={MEDIA_TYPE_OPTIONS}
                    onChange={(value) => {
                      setMediaType(String(value));
                      setCurrentPage(1);
                    }}
                  />
                </Form.Item>
              </AppFilterField>
              <AppFilterField width={165}>
                <Form.Item label="Trạng thái">
                  <AppSelect
                    width="100%"
                    value={approvalStatus}
                    options={APPROVAL_STATUS_OPTIONS}
                    onChange={(value) => {
                      setApprovalStatus(String(value));
                      setCurrentPage(1);
                    }}
                  />
                </Form.Item>
              </AppFilterField>
              <AppFilterField width={310}>
                <Form.Item label="Ngày tạo">
                  <AppDateRangePicker
                    width="100%"
                    value={dateRange}
                    startPlaceholder="Từ ngày"
                    endPlaceholder="Đến ngày"
                    onChange={(dates) => {
                      setDateRange(dates);
                      setCurrentPage(1);
                    }}
                  />
                </Form.Item>
              </AppFilterField>
              <AppFilterField
                width={250}
                className="source-media-panel__search-field">
                <Form.Item label="Từ khóa">
                  <AppSearch
                    width="100%"
                    placeholder="Tên kênh/ URL/ Tần số"
                    value={keyword}
                    onChange={(value) => {
                      setKeyword(value);
                      setCurrentPage(1);
                    }}
                  />
                </Form.Item>
              </AppFilterField>
            </AppFilter>
          </div>
          {loading ? (
            <div className="source-media-panel__empty"><Spin /></div>
          ) : loadError ? (
            <div className="source-media-panel__empty">Media could not be loaded. Use refresh to try again.</div>
          ) : paginatedMedia.length > 0 ? (
            <div
              className={[
                "source-media-grid",
                previewMedia ? "source-media-grid--with-preview" : "",
              ]
                .filter(Boolean)
                .join(" ")}>
              {paginatedMedia.map((media) => (
                <MediaCard
                  key={media.id}
                  media={media}
                  selected={selectedIds.includes(media.id)}
                  menuVariant="detail"
                  onSelect={handleToggleSelect}
                  onPreview={(item) => setPreviewMediaId(item.id)}
                  onView={handleOpenDetail}
                  onEdit={(item) => setEditingMedia(item)}
                  onApprove={handleApproveSingle}
                  onReject={handleRejectSingle}
                  processingStatus={media.hlsProcessingStatus}
                />
              ))}
            </div>
          ) : (
            <div className="source-media-panel__empty">
              Không tìm thấy Media phù hợp với điều kiện lọc.
            </div>
          )}
          <div className="source-media-panel__pagination">
            <AppPagination
              current={safePage}
              pageSize={PAGE_SIZE}
              total={filteredMedia.length}
              onChange={(page) => setCurrentPage(page)}
            />
          </div>
        </section>
        {previewMedia && (
          <MediaPreview
            key={previewMedia.id}
            media={{
              ...previewMedia,
              contentValue: previewMedia.attachmentOrLink,
              sharedLocations: previewMedia.sharedArea,
              durationSeconds: parseDurationSeconds(previewMedia.duration),
            }}
            onClose={() => setPreviewMediaId(null)}
          />
        )}
      </div>
          <MediaFormModal
        open={createModalOpen}
        mode="create"
        categories={categoryList}
        onCancel={() => setCreateModalOpen(false)}
        categoryOptions={categoryOptions}
        loading={saving}
        uploadProgress={uploadProgress}
        onSubmit={handleSaveMedia}
      />
      <MediaFormModal
        open={editingMedia !== null}
        mode="edit"
        initialValues={
          editingMedia
            ? {
                ...editingMedia,
                contentType: editingMedia.contentType,
                contentValue: editingMedia.attachmentOrLink,
                fileType: editingMedia.fileType,
              }
            : null
        }
        categories={categoryList}
        onCancel={() => setEditingMedia(null)}
        categoryOptions={categoryOptions}
        loading={saving}
        onSubmit={handleSaveMedia}
      />
      <AppConfirmModal
        open={approveModalOpen}
        type="success"
        title="Xác nhận duyệt media file"
        description="Media file bạn chọn sẽ được phê duyệt."
        confirmText="Tiếp tục"
        cancelText="Hủy"
        onConfirm={handleConfirmApprove}
        confirmLoading={saving}
        onCancel={() => setApproveModalOpen(false)}
      />
      <MediaRejectModal
        open={rejectModalOpen}
        loading={saving}
        onCancel={() => setRejectModalOpen(false)}
        onConfirm={async (reason) => {
          handleConfirmReject(reason);
        }}
      />
    </div>
  );
}
export default SourceMediaPage;
