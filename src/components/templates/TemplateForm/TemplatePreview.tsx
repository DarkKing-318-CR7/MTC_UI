import type { TemplateSource, TemplateLayer } from "../../../types/template.types";
import TemplateMediaPreview from "./TemplateMediaPreview";

import "./TemplatePreview.css";

interface TemplatePreviewProps {
  layers: TemplateLayer[];
  sources: TemplateSource[];
  activeLayerId: string | null;
  screenWidth: number;
  screenHeight: number;
  onSelect: (layerId: string) => void;
  presentation?: boolean;
  active?: boolean;
}

function TemplatePreview({
  layers,
  sources,
  activeLayerId,
  screenWidth,
  screenHeight,
  onSelect,
  presentation = false,
  active = true,
}: TemplatePreviewProps) {
  const safeWidth = screenWidth > 0 ? screenWidth : 1920;
  const safeHeight = screenHeight > 0 ? screenHeight : 1080;

  return (
    <div
      className={[
        "template-preview",
        presentation ? "template-preview--presentation" : "",
      ].filter(Boolean).join(" ")}
      style={{ aspectRatio: `${safeWidth} / ${safeHeight}` }}>
      {layers.map((layer) => {
        const source = sources.find((item) => item.id === layer.sourceId);
        const style = {
          left: `${(layer.x / safeWidth) * 100}%`,
          top: `${(layer.y / safeHeight) * 100}%`,
          width: `${layer.width}%`,
          height: `${layer.height}%`,
          zIndex: layer.zIndex,
        };

        return (
          <div
            key={layer.id}
            className={[
              "template-preview__layer",
              activeLayerId === layer.id && !presentation ? "is-active" : "",
            ].filter(Boolean).join(" ")}
            style={style}
            onMouseDown={() => {
              if (!presentation) onSelect(layer.id);
            }}
            title={source?.name || layer.zoneName || "Saved zone"}>
            {!active ? (
              <div className="template-preview__media">
                <span>Presentation preview is active</span>
              </div>
            ) : source ? (
              <TemplateMediaPreview source={source} fillContainer />
            ) : (
              <div className="template-preview__media">
                Saved zone
                <span>{layer.zoneName || "Media assignment is not stored by the backend"}</span>
              </div>
            )}
          </div>
        );
      })}

      {layers.length === 0 && (
        <div className="template-preview__empty">
          Select an approved Media item to design a template.
        </div>
      )}
    </div>
  );
}

export default TemplatePreview;
