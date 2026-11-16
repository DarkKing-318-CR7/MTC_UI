import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { ChevronDown, ChevronUp } from "lucide-react";

import AppIconButton from "../../../components/common/AppIconButton";
import AppTabs from "../../../components/common/AppTabs";
import type { AppTabItem } from "../../../components/common/AppTabs";
import MediaOverview from "../../../components/media/MediaOverview/MediaOverview";
import type { MediaOverviewDisplay } from "../../../components/media/MediaOverview/MediaOverview";
import MediaBroadcastList from "../../../components/media/MediaBroadcastList/MediaBroadcastList";
import type { BroadcastItem } from "../../../components/media/MediaBroadcastList/MediaBroadcastList";
import MediaSharedFacilities from "../../../components/media/MediaSharedFacilities/MediaSharedFacilities";
import type { SharedFacility } from "../../../components/media/MediaSharedFacilities/MediaSharedFacilities";
import mediaApi from "../../../api/mediaApi";
import mediaCategoryApi from "../../../api/mediaCategoryApi";
import { ROUTES } from "../../../constants/route.constants";
import { mapApprovalStatus, mapMediaItem } from "./data/sourceMediaApiMapper";
import type { SourceMediaItem } from "./types/sourceMedia.types";

import "./SourceMediaDetailPage.css";

const TABS: AppTabItem[] = [
  { key: "broadcasts", label: "Broadcast usage" },
  { key: "shared-facilities", label: "Shared facilities" },
];

function SourceMediaDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [media, setMedia] = useState<SourceMediaItem | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState("broadcasts");
  const [compact, setCompact] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setLoadError(null);
    if (!id) {
      setLoadError("Media ID is missing.");
      setLoading(false);
      return;
    }
    void Promise.all([mediaApi.getById(id), mediaCategoryApi.getAll()])
      .then(([item, categories]) => {
        if (active) setMedia(mapMediaItem(item, categories));
      })
      .catch((error: unknown) => {
        if (active) setLoadError(error instanceof Error ? error.message : "Unable to load media.");
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => { active = false; };
  }, [id]);

  useEffect(() => {
    setActiveTab("broadcasts");
    setCompact(false);
  }, [id]);

  useEffect(() => {
    const scrollParent = rootRef.current?.closest(".app-content") as HTMLElement | null;
    if (!scrollParent) return;
    const onScroll = () => setCompact(scrollParent.scrollTop > 100);
    scrollParent.addEventListener("scroll", onScroll, { passive: true });
    return () => scrollParent.removeEventListener("scroll", onScroll);
  }, [id]);

  const overview = useMemo<MediaOverviewDisplay | null>(() => {
    if (!media) return null;
    return {
      mediaId: media.id,
      name: media.fileName,
      url: media.url || media.sourceUrl,
      fileType: media.fileType,
      durationLabel: media.duration,
      sizeLabel: media.detailSizeLabel,
      approvalStatus: mapApprovalStatus(media.status),
      sourceType: media.sourceType,
      rejectionReason: media.rejectionReason,
      category: media.category,
      attachmentOrLink: media.attachmentOrLink,
      createdBy: media.createdBy,
      createdAt: media.createdAt,
      hlsProcessingStatus: media.hlsProcessingStatus,
      hlsPlaybackUrl: media.hlsPlaybackUrl,
      approvedBy: media.approvedBy,
      approvedAt: media.approvedAt,
      sharedArea: media.sharedArea,
    };
  }, [media]);

  if (loading || !media || !overview || !id) {
    return (
      <div className="source-media-detail source-media-detail--empty">
        <p>{loading ? "Loading media…" : loadError || "Media details are unavailable."}</p>
        <button type="button" onClick={() => navigate(ROUTES.SOURCE_MEDIA)}>
          Back to media list
        </button>
      </div>
    );
  }

  const noBroadcasts: BroadcastItem[] = [];
  const noSharedFacilities: SharedFacility[] = [];

  return (
    <div ref={rootRef} className="source-media-detail source-media-detail--shared">
      <section className={"source-media-detail__overview" + (compact ? " source-media-detail__overview--compact" : "")}>
        <MediaOverview media={overview} />
        <AppIconButton
          icon={compact ? <ChevronDown size={18} /> : <ChevronUp size={18} />}
          onClick={() => setCompact((value) => !value)}
          tooltip={compact ? "Expand details" : "Collapse details"}
        />
      </section>
      <section className="source-media-detail__bottom">
        <AppTabs items={TABS} activeKey={activeTab} onChange={setActiveTab} />
        {activeTab === "broadcasts" ? (
          <MediaBroadcastList key={"broadcasts-" + media.id} mediaId={media.id} data={noBroadcasts} />
        ) : (
          <MediaSharedFacilities key={"facilities-" + media.id} mediaId={media.id} data={noSharedFacilities} />
        )}
      </section>
    </div>
  );
}

export default SourceMediaDetailPage;
