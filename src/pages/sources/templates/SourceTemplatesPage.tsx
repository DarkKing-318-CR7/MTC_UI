import { useCallback, useEffect, useState } from "react";
import type { Key } from "react";
import { Alert, message, Spin } from "antd";
import { Plus, Trash2 } from "lucide-react";
import axios from "axios";
import { useNavigate } from "react-router-dom";

import TemplateList from "../../../components/templates/TemplateList";
import SourceNavigationTabs from "../components/SourceNavigationTabs";
import { useActionPanel } from "../../../contexts/ActionPanelContext";
import { useFacilityContext } from "../../../contexts/FacilityContext";
import { authApi } from "../../../api/authApi";
import { templateApi } from "../../../api/templateApi";
import { mapTemplateListItem } from "./data/sourceTemplateApiMapper";
import type { SourceTemplateListItem } from "./data/sourceTemplateApiMapper";

interface SourceTemplatesPageProps {
  selectedRowKeys?: Key[];
  onSelectionChange?: (keys: Key[]) => void;
  openCreate?: boolean;
  onCloseCreate?: () => void;
  deleteRequestId?: number;
  onDeleteComplete?: () => void;
}

function getErrorMessage(error: unknown): string {
  if (axios.isAxiosError(error)) {
    const status = error.response?.status;
    if (status === 401) return "Your session has expired. Sign in and retry.";
    if (status === 403) return "Your role or organization/facility scope cannot access templates.";
    if (status === 404) return "The requested template was not found.";
    if (status === 409) return "The template changed on the server. Refresh and retry.";
    const body = error.response?.data as { message?: string; detail?: string } | undefined;
    return body?.message || body?.detail || error.message || "Unable to load templates.";
  }
  return error instanceof Error ? error.message : "Unable to load templates.";
}

function SourceTemplatesPage({
  selectedRowKeys: controlledSelectedRowKeys,
  onSelectionChange,
  openCreate = false,
  onCloseCreate,
  deleteRequestId = 0,
  onDeleteComplete,
}: SourceTemplatesPageProps) {
  const navigate = useNavigate();
  const { setActions } = useActionPanel();
  const { selectedFacilityId, selectedFacility, loading: facilitiesLoading } = useFacilityContext();
  const [templates, setTemplates] = useState<SourceTemplateListItem[]>([]);
  const [internalSelectedRowKeys, setInternalSelectedRowKeys] = useState<Key[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [scopeReady, setScopeReady] = useState(false);

  const selectedRowKeys = controlledSelectedRowKeys ?? internalSelectedRowKeys;
  const setSelection = useCallback((keys: Key[]) => {
    onSelectionChange ? onSelectionChange(keys) : setInternalSelectedRowKeys(keys);
  }, [onSelectionChange]);

  const refreshTemplates = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const user = await authApi.getMe();
      const organizationId = user.organizationId ?? selectedFacility?.organizationId;
      if (!organizationId) throw new Error("Select an organization and facility before loading templates.");
      const facilityId = selectedFacilityId ?? user.facilityId ?? undefined;
      const rows = await templateApi.getAll(organizationId, facilityId ?? undefined);
      setTemplates(rows.map(mapTemplateListItem));
      setScopeReady(Boolean(facilityId));
    } catch (error) {
      setTemplates([]);
      setLoadError(getErrorMessage(error));
      setScopeReady(false);
    } finally {
      setLoading(false);
    }
  }, [selectedFacility?.organizationId, selectedFacilityId]);

  useEffect(() => { void refreshTemplates(); }, [refreshTemplates]);

  useEffect(() => {
    setActions([
      {
        key: "add-source-template",
        icon: <Plus />,
        tooltip: "Add template",
        onClick: () => navigate("/sources/templates/create"),
      },
      {
        key: "delete-source-template",
        icon: <Trash2 />,
        tooltip: "Deletion is unavailable until the backend exposes template usage state",
        danger: true,
        disabled: selectedRowKeys.length === 0,
        onClick: () => message.warning("The backend does not expose whether a template is in use. Deletion is disabled to preserve the SRS rule."),
      },
    ]);
    return () => setActions([]);
  }, [navigate, selectedRowKeys.length, setActions]);

  useEffect(() => {
    if (!openCreate) return;
    onCloseCreate?.();
    navigate("/sources/templates/create");
  }, [openCreate, onCloseCreate, navigate]);

  useEffect(() => {
    if (!deleteRequestId) return;
    onDeleteComplete?.();
    message.warning("The backend does not expose whether a template is in use. Deletion is disabled to preserve the SRS rule.");
  }, [deleteRequestId, onDeleteComplete]);

  const handleEdit = () => {
    message.warning("The backend does not expose whether a template is in use. Editing is disabled to preserve the SRS rule.");
  };

  return (
    <>
      <SourceNavigationTabs />
      {loadError && (
        <Alert
          type="error"
          showIcon
          message={loadError}
          action={<button type="button" onClick={() => void refreshTemplates()}>Retry</button>}
        />
      )}
      {facilitiesLoading && !scopeReady ? <Spin /> : null}
      {!loadError && loading ? <Spin /> : null}
      {!loading && !loadError && !scopeReady && (
        <Alert type="warning" showIcon message="Choose a facility to create templates." />
      )}
      {!loadError && !loading && (
        <TemplateList
          templates={templates}
          selectedRowKeys={selectedRowKeys}
          onSelectionChange={setSelection}
          onEdit={handleEdit}
          onDetail={(id) => navigate(`/sources/templates/${id}`)}
          showUsageStatus={false}
          showActivationStatus
          pageSize={10}
          canEdit={() => false}
        />
      )}
    </>
  );
}

export default SourceTemplatesPage;
