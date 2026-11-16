import { useEffect, useMemo, useState } from "react";
import { Alert, Empty, message, Spin } from "antd";
import axios from "axios";
import { useNavigate, useParams } from "react-router-dom";

import AppTabs from "../../../components/common/AppTabs";
import AppButton from "../../../components/common/AppButton";
import TemplateForm from "../../../components/templates/TemplateForm";
import { authApi } from "../../../api/authApi";
import mediaApi from "../../../api/mediaApi";
import { templateApi } from "../../../api/templateApi";
import { useFacilityContext } from "../../../contexts/FacilityContext";
import { useActionPanel } from "../../../contexts/ActionPanelContext";
import type { TemplateApiItem } from "../../../api/templateApi";
import type { TemplateFormData, TemplateFormMode, TemplateSource } from "../../../types/template.types";
import { buildTemplateUpsertRequest, mapEligibleTemplateSources, mapTemplateToForm } from "./data/sourceTemplateApiMapper";

import "./SourceTemplateFormPage.css";

interface SourceTemplateFormPageProps { mode: TemplateFormMode }
type DetailTab = "information" | "news";

function getErrorMessage(error: unknown, action: string): string {
  if (axios.isAxiosError(error)) {
    const status = error.response?.status;
    if (status === 401) return "Your session has expired. Sign in and retry.";
    if (status === 403) return "Your role or organization/facility scope cannot perform this operation.";
    if (status === 404) return "The template or media was not found.";
    if (status === 409) return "The template changed on the server. Refresh before retrying.";
    const body = error.response?.data as { message?: string; detail?: string } | undefined;
    return body?.message || body?.detail || error.message || action;
  }
  return error instanceof Error ? error.message : action;
}

function SourceTemplateFormPage({ mode }: SourceTemplateFormPageProps) {
  const navigate = useNavigate();
  const { setActions } = useActionPanel();
  const { selectedFacilityId, selectedFacility } = useFacilityContext();
  const { templateId } = useParams<{ templateId: string }>();
  const isCreate = mode === "create";
  const isEdit = mode === "edit";
  const isView = mode === "view";

  const [template, setTemplate] = useState<TemplateApiItem | null>(null);
  const [sources, setSources] = useState<TemplateSource[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [sourceError, setSourceError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<DetailTab>("information");

  useEffect(() => {
    let active = true;
    setLoading(true);
    setLoadError(null);
    setSourceError(null);
    void (async () => {
      try {
        const tasks: [Promise<TemplateApiItem | null>, ReturnType<typeof mediaApi.getAll>] = [
          isCreate
            ? Promise.resolve(null)
            : templateId
              ? templateApi.getById(templateId)
              : Promise.reject(new Error("Template ID is missing.")),
          mediaApi.getAll(),
        ];
        const [templateResult, mediaResult] = await Promise.allSettled(tasks);
        if (!active) return;

        if (templateResult.status === "fulfilled") setTemplate(templateResult.value);
        else setLoadError(getErrorMessage(templateResult.reason, "Unable to load template."));

        if (mediaResult.status === "fulfilled") {
          setSources(mapEligibleTemplateSources(mediaResult.value));
        } else {
          setSources([]);
          setSourceError(getErrorMessage(mediaResult.reason, "Unable to load approved media."));
        }
      } catch (error) {
        if (active) setLoadError(getErrorMessage(error, "Unable to load template."));
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => { active = false; };
  }, [isCreate, templateId]);

  const initialData = useMemo(
    () => template ? mapTemplateToForm(template) : undefined,
    [template],
  );

  useEffect(() => {
    setActions([]);
    return () => setActions([]);
  }, [setActions]);

  const handleCancel = () => {
    if (isEdit && templateId) navigate(`/sources/templates/${templateId}`);
    else navigate("/sources/templates");
  };

  const handleEdit = () => {
    message.warning("The backend does not expose whether this template is in use. Editing is disabled to preserve the SRS rule.");
  };

  const handleSave = async (data: TemplateFormData) => {
    try {
      if (!isCreate) {
        // The UI keeps this route guarded because no usage-state contract exists.
        if (!template || !templateId) throw new Error("Template data is unavailable.");
        const payload = buildTemplateUpsertRequest(
          data,
          template.organizationId,
          template.facilityId,
          sources,
        );
        await templateApi.update(templateId, payload);
        message.success("Template updated by the server.");
        navigate(`/sources/templates/${templateId}`);
        return;
      }

      const user = await authApi.getMe();
      const organizationId = user.organizationId ?? selectedFacility?.organizationId;
      const facilityId = selectedFacilityId ?? user.facilityId;
      if (!organizationId || !facilityId) {
        throw new Error("Select an organization and facility before creating a template.");
      }
      const payload = buildTemplateUpsertRequest(data, organizationId, facilityId, sources);
      await templateApi.create(payload);
      message.success("Template created by the server.");
      navigate("/sources/templates");
    } catch (error) {
      message.error(getErrorMessage(error, isCreate ? "Unable to create template." : "Unable to update template."));
    }
  };

  if (loading) return <Spin />;
  if (loadError) {
    return (
      <div className="source-template-detail__not-found">
        <Alert type="error" showIcon message={loadError} />
        <AppButton variant="outline" onClick={() => navigate("/sources/templates")}>Back to templates</AppButton>
      </div>
    );
  }
  if (!isCreate && !template) {
    return (
      <div className="source-template-detail__not-found">
        <Empty description="Template not found">
          <AppButton variant="outline" onClick={() => navigate("/sources/templates")}>Back to templates</AppButton>
        </Empty>
      </div>
    );
  }

  if (isEdit) {
    return (
      <div className="source-template-detail__not-found">
        <Alert
          type="warning"
          showIcon
          message="Editing is unavailable because the backend does not expose template usage state, and the SRS prohibits editing a used template."
        />
        <AppButton variant="outline" onClick={() => navigate(`/sources/templates/${templateId}`)}>Back to details</AppButton>
      </div>
    );
  }

  return (
    <div className="source-template-detail">
      {sourceError && <Alert type="error" showIcon message={sourceError} />}
      {isCreate && !selectedFacilityId && (
        <Alert type="warning" showIcon message="Choose a facility before saving this template." />
      )}
      {isView && (
        <AppTabs
          className="source-template-detail__tabs"
          activeKey={activeTab}
          onChange={(key) => setActiveTab(key as DetailTab)}
          items={[
            { key: "information", label: "Template information" },
            { key: "news", label: "Usage" },
          ]}
        />
      )}
      {(!isView || activeTab === "information") && (
        <TemplateForm
          mode={mode}
          sources={sources}
          initialData={initialData}
          onCancel={handleCancel}
          onSave={handleSave}
          onEdit={handleEdit}
          canEdit={false}
        />
      )}
      {isView && activeTab === "news" && (
        <Empty description="The backend does not expose template usage records." />
      )}
    </div>
  );
}

export default SourceTemplateFormPage;
