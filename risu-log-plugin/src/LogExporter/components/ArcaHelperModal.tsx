import React, { useState, useCallback, useEffect, useMemo, useRef } from "react";
import { createZipFromMediaList } from "../../services/zipService";
import {
  copyToClipboard,
  saveAsFile,
  sanitizeFilename,
} from "../services/fileService";
import type {
  CharInfo,
  ArcaImage,
  GlobalSettings,
  ColorPalette,
} from "../../types";
import type { LogExporterSettings } from "../hooks/types";
import { getLogHtml } from "../services/htmlGenerator";
import { uploadMediaToArca } from "../services/arcaUploadService";
import {
  isArcaProxyConfigured,
  loadArcaProxyConfig,
  type ArcaProxyConfig,
} from "../services/arcaProxyConfigService";
import { Steps, Button, Alert, Input, Spin, Result } from "../../components/ui";
import {
  Download,
  FilePlus,
  Copy,
  UploadCloud,
  Server,
  X,
  AlertTriangle,
  RotateCcw,
  FileCode,
  Check,
  Code2,
  Eye,
  CheckCircle2,
} from "lucide-react";
import ArcaliveMethodCard from "./ArcaliveMethodCard";

// ============================================================================
// Types & Contracts
// ============================================================================

/**
 * Props passed to the ArcaHelperModal component.
 */
export interface ArcaHelperModalProps {
  /** Whether the modal is currently open and visible */
  isOpen: boolean;
  /** Callback fired when closing the modal */
  onClose: () => void;
  /** Filtered message DOM nodes selected for export */
  messageNodes: HTMLElement[];
  /** Character & chat metadata */
  charInfo: CharInfo;
  /** Log exporter settings configuration */
  settings: LogExporterSettings | Partial<LogExporterSettings>;
  /** Global plugin settings */
  globalSettings: GlobalSettings;
  /** Active UI theme identifier ('dark', 'light', etc.) */
  uiTheme?: string;
  /** Active color palette configuration */
  colorPalette?: ColorPalette;
}

/**
 * Multi-step wizard progression stages.
 */
export type ArcaWizardStep = "intro" | "paste_urls" | "done";

/**
 * Upload & transfer methods supported by the wizard.
 */
export type TransferMethod = "proxy" | "direct" | "base64" | "manual" | null;

/**
 * Progress tracking state during upload or media bundling.
 */
export interface ArcaProgressState {
  message: string;
  current: number;
  total: number;
  filename: string;
}

// ============================================================================
// Media & Text Utility Functions
// ============================================================================

/**
 * Resolves the appropriate file extension for a given media URL or Data URL.
 */
function getMediaExtension(src: string, fallback = "jpg"): string {
  const dataMime = src.match(/^data:([^;,]+)/i)?.[1]?.toLowerCase();
  const mimeExtensions: Record<string, string> = {
    "image/gif": "gif",
    "image/jpeg": "jpg",
    "image/png": "png",
    "image/webp": "webp",
    "video/mp4": "mp4",
    "video/quicktime": "mov",
    "video/webm": "webm",
  };
  if (dataMime && mimeExtensions[dataMime]) {
    return mimeExtensions[dataMime];
  }

  try {
    const pathname = new URL(src, window.location.href).pathname;
    const extension = pathname.match(/\.([a-z0-9]{2,5})$/i)?.[1]?.toLowerCase();
    if (extension) {
      return extension === "jpeg" ? "jpg" : extension;
    }
  } catch {
    // Fall back to fallback parameter on parse failure
  }
  return fallback;
}

/**
 * Extracts all valid image URLs declared within a CSS `background-image` property value.
 */
function getCssImageUrls(backgroundImage: string): string[] {
  const urls: string[] = [];
  const urlPattern = /url\(\s*(?:"([^"]*)"|'([^']*)'|([^)]*?))\s*\)/gi;
  let match: RegExpExecArray | null;
  while ((match = urlPattern.exec(backgroundImage)) !== null) {
    const url = (match[1] || match[2] || match[3] || "").trim();
    if (url) {
      urls.push(url);
    }
  }
  return urls;
}

/**
 * Extracts all `<img>` tag `src` attributes from an HTML snippet.
 */
function extractImgSrcs(html: string): string[] {
  if (!html.trim()) return [];
  const tempDiv = document.createElement("div");
  tempDiv.innerHTML = html;
  return Array.from(tempDiv.querySelectorAll("img"))
    .map((img) => img.src)
    .filter(Boolean);
}

/**
 * Replaces registered media placeholder identifiers in HTML with their target URLs.
 */
function replaceImagePlaceholders(
  html: string,
  sourceImages: ArcaImage[],
  urls: string[],
): string {
  let result = html;
  sourceImages.forEach((imageInfo, index) => {
    const replacement = urls[index];
    if (!replacement) return;
    const placeholder =
      imageInfo.placeholder || `__TOLOG_PLACEHOLDER_${imageInfo.url}__`;
    result = result.split(placeholder).join(replacement);
  });
  return result;
}

/**
 * Formats a byte length into a human-readable size string (B, KB, MB).
 */
function formatByteSize(byteLength: number): string {
  if (byteLength < 1024) return `${byteLength} B`;
  if (byteLength < 1024 * 1024) return `${(byteLength / 1024).toFixed(1)} KB`;
  return `${(byteLength / (1024 * 1024)).toFixed(2)} MB`;
}

/**
 * Extracts a concise, human-readable error message from an unknown thrown value.
 */
function extractErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  if (typeof error === "string") {
    return error;
  }
  return "알 수 없는 오류가 발생했습니다.";
}

// ============================================================================
// Sub-Components
// ============================================================================

/**
 * Header bar for the ArcaLive helper modal.
 */
interface ArcaModalHeaderProps {
  onClose: () => void;
  step: ArcaWizardStep;
  onRestart: () => void;
  isProcessing: boolean;
}

const ArcaModalHeader: React.FC<ArcaModalHeaderProps> = ({
  onClose,
  step,
  onRestart,
  isProcessing,
}) => {
  return (
    <header
      style={{
        display: "flex",
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        gap: "12px",
        paddingBottom: "12px",
        borderBottom: "1px solid var(--border-color, #27272a)",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
        <h3 style={{ margin: 0, fontSize: "1.15rem", fontWeight: 700 }}>
          아카라이브 내보내기
        </h3>
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
        {step !== "intro" && !isProcessing && (
          <Button
            size="small"
            icon={<RotateCcw size={13} />}
            onClick={onRestart}
            title="방식 선택으로 돌아가기"
            style={{ fontSize: "0.82rem" }}
          >
            처음으로
          </Button>
        )}
        <Button
          style={{
            height: "30px",
            width: "30px",
            margin: "0",
            borderRadius: "6px",
            padding: "4px",
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
          }}
          onClick={onClose}
          aria-label="닫기"
        >
          <X size={16} />
        </Button>
      </div>
    </header>
  );
};

/**
 * Step 1: Method selection options card list.
 */
interface ArcaMethodSelectStepProps {
  isProxyConfigLoading: boolean;
  proxyConfig: ArcaProxyConfig;
  isProcessing: boolean;
  onSelectProxy: () => void;
  onSelectDirect: () => void;
  onSelectBase64: () => void;
  onSelectManual: () => void;
}

const ArcaMethodSelectStep: React.FC<ArcaMethodSelectStepProps> = ({
  isProxyConfigLoading,
  proxyConfig,
  isProcessing,
  onSelectProxy,
  onSelectDirect,
  onSelectBase64,
  onSelectManual,
}) => {
  const isProxyReady = isArcaProxyConfigured(proxyConfig);

  return (
    <div
      className="arca-helper-step"
      style={{ display: "flex", flexDirection: "column", gap: "10px" }}
    >
      {/* 1. User Proxy Mode */}
      <ArcaliveMethodCard
        Icon={Server}
        onClick={onSelectProxy}
        title="사용자 프록시 업로드"
        description="지정한 프록시 서버를 통해 아카라이브 이미지 서버로 이미지를 안전하게 업로드합니다."
        badge="Proxy"
        badgeVariant="info"
        loading={isProxyConfigLoading || isProcessing}
        disabled={!isProxyConfigLoading && !isProxyReady}
        extra={
          !isProxyConfigLoading && !isProxyReady ? (
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: "6px",
                padding: "6px 10px",
                borderRadius: "6px",
                backgroundColor: "rgba(245, 158, 11, 0.1)",
                border: "1px solid rgba(245, 158, 11, 0.25)",
                fontSize: "0.82rem",
                color: "#fbbf24",
              }}
            >
              <AlertTriangle size={13} style={{ flexShrink: 0 }} />
              <span>플러그인 설정에서 프록시 URL과 토큰을 먼저 저장해 주세요.</span>
            </div>
          ) : isProxyReady ? (
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: "6px",
                fontSize: "0.78rem",
                color: "var(--text-secondary, #a1a1aa)",
              }}
            >
              <CheckCircle2 size={12} color="#4ade80" />
              <span>프록시 설정됨: {proxyConfig.url}</span>
            </div>
          ) : null
        }
      />

      {/* 2. Direct Risu Upload Mode */}
      <ArcaliveMethodCard
        Icon={UploadCloud}
        onClick={onSelectDirect}
        title="Risu 직접 업로드"
        description="별도 프록시 없이 아카라이브 이미지 서버에 직접 업로드합니다. Cloudflare 차단 시 사용자 프록시를 권장합니다."
        badge="Direct"
        badgeVariant="recommended"
        loading={isProcessing}
      />

      {/* 3. Base64 Inline Mode */}
      <ArcaliveMethodCard
        Icon={FileCode}
        onClick={onSelectBase64}
        title="Base64 인라인 임베드"
        description="외부 업로드 없이 이미지를 Base64 데이터로 HTML 내부에 직접 포함합니다. 이미지가 적은 로그에 추천합니다."
        badge="Base64"
        badgeVariant="purple"
        loading={isProcessing}
      />

      {/* 4. Manual ZIP Download Mode */}
      <ArcaliveMethodCard
        Icon={Download}
        onClick={onSelectManual}
        title="ZIP 수동 다운로드"
        description="이미지를 ZIP으로 다운로드한 뒤 아카라이브 편집기에 수동 업로드하여 HTML 태그를 가져옵니다."
        badge="ZIP 수동"
        badgeVariant="secondary"
        loading={isProcessing}
      />
    </div>
  );
};

/**
 * Active processing and progress indicator view.
 */
interface ArcaUploadProgressViewProps {
  progress: ArcaProgressState | null;
  transferMethod: TransferMethod;
}

const ArcaUploadProgressView: React.FC<ArcaUploadProgressViewProps> = ({
  progress,
  transferMethod,
}) => {
  const methodTitle = useMemo(() => {
    switch (transferMethod) {
      case "proxy":
        return "사용자 프록시 업로드 진행 중";
      case "direct":
        return "아카라이브 직접 업로드 진행 중";
      case "base64":
        return "Base64 인라인 생성 중";
      case "manual":
        return "ZIP 압축 파일 생성 중";
      default:
        return "처리 중...";
    }
  }, [transferMethod]);

  const percent = useMemo(() => {
    if (!progress || progress.total <= 0) return 0;
    return Math.min(100, Math.round((progress.current / progress.total) * 100));
  }, [progress]);

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        minHeight: "240px",
        padding: "24px 16px",
        gap: "16px",
        textAlign: "center",
      }}
    >
      <Spin size="large" />

      <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
        <span
          style={{
            fontWeight: 700,
            fontSize: "1.08rem",
            color: "var(--text-primary, #ffffff)",
          }}
        >
          {methodTitle}
        </span>
        <span
          style={{
            fontSize: "0.88rem",
            color: "var(--text-secondary, #a1a1aa)",
          }}
        >
          {progress?.message || "잠시만 기다려주세요. 미디어 변환 및 처리가 진행 중입니다."}
        </span>
      </div>

      {progress && progress.total > 0 && (
        <div
          style={{
            width: "100%",
            maxWidth: "360px",
            display: "flex",
            flexDirection: "column",
            gap: "6px",
          }}
        >
          {/* Progress bar container */}
          <div
            style={{
              width: "100%",
              height: "6px",
              backgroundColor: "var(--border-color, rgba(255,255,255,0.1))",
              borderRadius: "9999px",
              overflow: "hidden",
            }}
          >
            <div
              style={{
                width: `${percent}%`,
                height: "100%",
                backgroundColor: "var(--primary, #3b82f6)",
                borderRadius: "9999px",
                transition: "width 0.25s ease-out",
              }}
            />
          </div>

          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              fontSize: "0.78rem",
              color: "var(--text-secondary, #a1a1aa)",
            }}
          >
            <span>{progress.filename || "업로드 진행"}</span>
            <span>
              {progress.current} / {progress.total} ({percent}%)
            </span>
          </div>
        </div>
      )}
    </div>
  );
};

/**
 * Step 2: Manual URL association and paste screen.
 */
interface ArcaPasteUrlsStepProps {
  images: ArcaImage[];
  pastedHtml: string;
  onPastedHtmlChange: (val: string) => void;
  onBack: () => void;
  onGenerate: () => void;
}

const ArcaPasteUrlsStep: React.FC<ArcaPasteUrlsStepProps> = ({
  images,
  pastedHtml,
  onPastedHtmlChange,
  onBack,
  onGenerate,
}) => {
  const detectedUrls = useMemo(() => extractImgSrcs(pastedHtml), [pastedHtml]);
  const isMatch = detectedUrls.length === images.length;
  const hasInput = pastedHtml.trim().length > 0;

  return (
    <div
      className="arca-helper-step"
      style={{ display: "flex", flexDirection: "column", gap: "14px" }}
    >
      <div className="arca-instruction-card">
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            marginBottom: "8px",
          }}
        >
          <h4 style={{ margin: 0, fontWeight: 700, fontSize: "0.98rem" }}>
            2단계: 아카라이브 이미지 태그 붙여넣기
          </h4>
          <span
            style={{
              fontSize: "0.75rem",
              padding: "2px 8px",
              borderRadius: "9999px",
              backgroundColor: "rgba(59, 130, 246, 0.15)",
              color: "var(--primary, #3b82f6)",
              fontWeight: 600,
            }}
          >
            필요 이미지: {images.length}개
          </span>
        </div>

        <p
          style={{
            margin: 0,
            fontSize: "0.86rem",
            color: "var(--text-secondary, #a1a1aa)",
            lineHeight: 1.45,
          }}
        >
          다운로드된 ZIP 파일의 압축을 푼 뒤 아카라이브 글쓰기 창에 모든 이미지를 업로드하세요.
        </p>

        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: "5px",
            marginTop: "10px",
            paddingLeft: "10px",
            borderLeft: "2px solid var(--border-color, #27272a)",
            fontSize: "0.84rem",
            color: "var(--text-secondary, #a1a1aa)",
          }}
        >
          <div>
            1. 아카라이브 편집기를 <b>HTML 모드</b>(소스 보기)로 전환합니다.
          </div>
          <div>
            2. 업로드된 이미지 태그(<code>{"<img>"}</code>) 전체를 복사하여 아래에 붙여넣으세요.
          </div>
        </div>
      </div>

      {/* Live Tag Count Detection Chip */}
      {hasInput && (
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "8px 12px",
            borderRadius: "6px",
            fontSize: "0.82rem",
            backgroundColor: isMatch
              ? "rgba(34, 197, 94, 0.1)"
              : "rgba(245, 158, 11, 0.1)",
            border: `1px solid ${
              isMatch ? "rgba(34, 197, 94, 0.3)" : "rgba(245, 158, 11, 0.3)"
            }`,
            color: isMatch ? "#4ade80" : "#fbbf24",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
            {isMatch ? <Check size={14} /> : <AlertTriangle size={14} />}
            <span>
              감지된 <code>{"<img>"}</code> 태그: {detectedUrls.length}개 / 원본 {images.length}개
            </span>
          </div>
          <span style={{ fontWeight: 600 }}>
            {isMatch ? "개수 일치" : "개수 불일치"}
          </span>
        </div>
      )}

      <Input.TextArea
        className="arca-paste-area"
        value={pastedHtml}
        onChange={(e) => onPastedHtmlChange(e.target.value)}
        placeholder="여기에 아카라이브 편집기에서 복사한 <img> 태그들을 붙여넣으세요..."
        autoSize={{ minRows: 6, maxRows: 12 }}
        style={{
          fontFamily: "monospace",
          fontSize: "0.86rem",
          backgroundColor: "var(--bg-secondary, #18181b)",
          color: "var(--foreground, #ffffff)",
          border: "1px solid var(--border-color, #27272a)",
          borderRadius: "8px",
          padding: "10px",
        }}
      />

      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          gap: "8px",
        }}
      >
        <Button onClick={onBack} size="small" style={{ fontSize: "0.84rem" }}>
          이전으로
        </Button>
        <Button
          type="primary"
          icon={<FilePlus size={14} />}
          onClick={onGenerate}
          disabled={!hasInput}
        >
          최종 HTML 생성
        </Button>
      </div>
    </div>
  );
};

/**
 * Step 3: Finished export result view with HTML code & live preview toggle.
 */
interface ArcaDoneStepProps {
  finalHtml: string;
  transferMethod: TransferMethod;
  imageCount: number;
  charName: string;
  hasCopied: boolean;
  onCopy: () => void;
  onRestart: () => void;
}

const ArcaDoneStep: React.FC<ArcaDoneStepProps> = ({
  finalHtml,
  transferMethod,
  imageCount,
  charName,
  hasCopied,
  onCopy,
  onRestart,
}) => {
  const [activeTab, setActiveTab] = useState<"code" | "preview">("code");
  const htmlSizeStr = useMemo(
    () => formatByteSize(new Blob([finalHtml]).size),
    [finalHtml],
  );

  const methodLabel = useMemo(() => {
    switch (transferMethod) {
      case "proxy":
        return "사용자 프록시";
      case "direct":
        return "Risu 직접";
      case "base64":
        return "Base64 인라인";
      case "manual":
        return "ZIP 수동";
      default:
        return "완료";
    }
  }, [transferMethod]);

  const handleSaveSource = () => {
    const safeCharName = sanitizeFilename(charName || "Character");
    saveAsFile(`Arca_HTML_${safeCharName}.txt`, finalHtml);
  };

  return (
    <div
      className="arca-helper-step"
      style={{ display: "flex", flexDirection: "column", gap: "12px" }}
    >
      {/* Top Banner with Stats */}
      <div className="arca-instruction-card" style={{ padding: "12px 16px" }}>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            flexWrap: "wrap",
            gap: "8px",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <CheckCircle2 size={18} color="#4ade80" />
            <span style={{ fontWeight: 700, fontSize: "0.98rem" }}>
              내보내기 준비 완료!
            </span>
          </div>

          {/* Stats Badges */}
          <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
            <span
              style={{
                fontSize: "0.72rem",
                padding: "2px 8px",
                borderRadius: "9999px",
                backgroundColor: "rgba(255,255,255,0.08)",
                border: "1px solid var(--border-color, #27272a)",
                color: "var(--text-secondary, #a1a1aa)",
                fontWeight: 600,
              }}
            >
              방식: {methodLabel}
            </span>
            {imageCount > 0 && (
              <span
                style={{
                  fontSize: "0.72rem",
                  padding: "2px 8px",
                  borderRadius: "9999px",
                  backgroundColor: "rgba(59, 130, 246, 0.15)",
                  color: "var(--primary, #3b82f6)",
                  fontWeight: 600,
                }}
              >
                이미지 {imageCount}개
              </span>
            )}
            <span
              style={{
                fontSize: "0.72rem",
                padding: "2px 8px",
                borderRadius: "9999px",
                backgroundColor: "rgba(255,255,255,0.08)",
                color: "var(--text-secondary, #a1a1aa)",
              }}
            >
              {htmlSizeStr}
            </span>
          </div>
        </div>

        <p
          style={{
            margin: "8px 0 0 0",
            fontSize: "0.85rem",
            color: "var(--text-secondary, #a1a1aa)",
          }}
        >
          아래 생성된 HTML 코드를 복사하여 아카라이브 편집기의 <b>HTML 모드</b>에 붙여넣으세요.
        </p>
      </div>

      {/* View Switch Header: Code vs Preview */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          gap: "8px",
        }}
      >
        <div style={{ display: "flex", gap: "4px" }}>
          <Button
            size="small"
            type={activeTab === "code" ? "primary" : "default"}
            icon={<Code2 size={13} />}
            onClick={() => setActiveTab("code")}
            style={{ fontSize: "0.82rem" }}
          >
            HTML 코드
          </Button>
          <Button
            size="small"
            type={activeTab === "preview" ? "primary" : "default"}
            icon={<Eye size={13} />}
            onClick={() => setActiveTab("preview")}
            style={{ fontSize: "0.82rem" }}
          >
            미리보기
          </Button>
        </div>

        <span
          style={{
            fontSize: "0.78rem",
            color: "var(--text-secondary, #a1a1aa)",
          }}
        >
          {activeTab === "code"
            ? "클릭 시 전체 선택됩니다"
            : "렌더링 시각 확인"}
        </span>
      </div>

      {/* Code Area or Live Preview Viewport */}
      {activeTab === "code" ? (
        <Input.TextArea
          className="arca-paste-area"
          value={finalHtml}
          readOnly
          autoSize={{ minRows: 7, maxRows: 14 }}
          style={{
            fontFamily: "monospace",
            fontSize: "0.86rem",
            backgroundColor: "var(--bg-secondary, #18181b)",
            color: "var(--foreground, #ffffff)",
            border: "1px solid var(--border-color, #27272a)",
            borderRadius: "8px",
            padding: "10px",
          }}
          onClick={(e) => (e.target as HTMLTextAreaElement).select()}
        />
      ) : (
        <div
          style={{
            width: "100%",
            height: "320px",
            borderRadius: "8px",
            border: "1px solid var(--border-color, #27272a)",
            backgroundColor: "var(--bg-secondary, #18181b)",
            overflow: "hidden",
          }}
        >
          <iframe
            title="ArcaLive HTML Preview"
            srcDoc={finalHtml}
            sandbox="allow-same-origin"
            style={{
              width: "100%",
              height: "100%",
              border: "none",
              backgroundColor: "transparent",
            }}
          />
        </div>
      )}

      {/* Action Buttons */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          gap: "8px",
          marginTop: "4px",
        }}
      >
        <Button
          size="small"
          icon={<RotateCcw size={13} />}
          onClick={onRestart}
          style={{ fontSize: "0.82rem" }}
        >
          다시 내보내기
        </Button>

        <div style={{ display: "flex", gap: "8px" }}>
          <Button
            icon={<Download size={14} />}
            onClick={handleSaveSource}
            style={{ fontSize: "0.85rem" }}
          >
            HTML 파일 저장
          </Button>

          <Button
            type="primary"
            icon={hasCopied ? <Check size={14} /> : <Copy size={14} />}
            onClick={onCopy}
            style={{
              fontSize: "0.85rem",
              backgroundColor: hasCopied ? "#22c55e" : undefined,
              borderColor: hasCopied ? "#22c55e" : undefined,
            }}
          >
            {hasCopied ? "복사 완료!" : "HTML 복사"}
          </Button>
        </div>
      </div>
    </div>
  );
};

/**
 * Error display view with retry and back options.
 */
interface ArcaErrorViewProps {
  errorMessage: string;
  onRetry: () => void;
  onBack: () => void;
}

const ArcaErrorView: React.FC<ArcaErrorViewProps> = ({
  errorMessage,
  onRetry,
  onBack,
}) => {
  return (
    <Result
      status="error"
      title={<span style={{ color: "var(--text-primary)" }}>업로드 실패</span>}
      subTitle={
        <span
          style={{
            color: "var(--text-secondary)",
            fontSize: "0.9em",
            wordBreak: "break-all",
          }}
        >
          {errorMessage}
        </span>
      }
      extra={[
        <Button
          key="retry"
          type="primary"
          icon={<RotateCcw size={14} />}
          onClick={onRetry}
        >
          다시 시도
        </Button>,
        <Button key="back" onClick={onBack}>
          방식 선택으로 돌아가기
        </Button>,
      ]}
    />
  );
};

// ============================================================================
// Main Modal Component
// ============================================================================

/**
 * ArcaHelperModal coordinates multi-step export & upload workflows for ArcaLive.
 * Supports User Proxy, Direct Upload, Base64 embedding, and Manual ZIP download.
 */
const ArcaHelperModal: React.FC<ArcaHelperModalProps> = ({
  isOpen,
  onClose,
  messageNodes,
  charInfo,
  settings,
  globalSettings,
  uiTheme,
  colorPalette,
}) => {
  // Wizard state
  const [step, setStep] = useState<ArcaWizardStep>("intro");
  const [baseHtml, setBaseHtml] = useState("");
  const [images, setImages] = useState<ArcaImage[]>([]);
  const [pastedHtml, setPastedHtml] = useState("");
  const [finalHtml, setFinalHtml] = useState("");
  const [error, setError] = useState<string | null>(null);

  // Processing state
  const [isProcessing, setIsProcessing] = useState(false);
  const [processingProgress, setProcessingProgress] =
    useState<ArcaProgressState | null>(null);
  const [processingError, setProcessingError] = useState<string | null>(null);

  // Method tracking
  const [transferMethod, setTransferMethod] = useState<TransferMethod>(null);
  const [lastMethod, setLastMethod] = useState<TransferMethod>(null);

  // Copy feedback state
  const [hasCopied, setHasCopied] = useState(false);
  const copyTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Proxy configuration
  const [proxyConfig, setProxyConfig] = useState<ArcaProxyConfig>({
    url: "",
    token: "",
  });
  const [isProxyConfigLoading, setIsProxyConfigLoading] = useState(false);

  // Load proxy configuration on modal open
  useEffect(() => {
    if (!isOpen) return;
    let cancelled = false;
    setIsProxyConfigLoading(true);

    void loadArcaProxyConfig().then((config) => {
      if (!cancelled) {
        setProxyConfig(config);
        setIsProxyConfigLoading(false);
      }
    });

    return () => {
      cancelled = true;
    };
  }, [isOpen]);

  // Clean up copy feedback timer on unmount
  useEffect(() => {
    return () => {
      if (copyTimerRef.current) {
        clearTimeout(copyTimerRef.current);
      }
    };
  }, []);

  /**
   * Resets all modal state back to initial intro stage.
   */
  const handleRestart = useCallback(() => {
    setStep("intro");
    setBaseHtml("");
    setImages([]);
    setPastedHtml("");
    setFinalHtml("");
    setError(null);
    setIsProcessing(false);
    setProcessingProgress(null);
    setProcessingError(null);
    setTransferMethod(null);
    setLastMethod(null);
    setHasCopied(false);
  }, []);

  /**
   * Closes the modal and resets internal state.
   */
  const handleClose = useCallback(() => {
    handleRestart();
    onClose();
  }, [handleRestart, onClose]);

  /**
   * Collects export HTML and extracts media assets with unique placeholders.
   */
  const collectExportContent = useCallback(async (): Promise<{
    html: string;
    images: ArcaImage[];
  }> => {
    const logHtml = await getLogHtml({
      nodes: messageNodes,
      charInfo,
      selectedThemeKey: settings.theme,
      color: colorPalette,
      showAvatar: settings.showAvatar,
      showHeader: settings.showHeader,
      showHeaderIcon: settings.showHeaderIcon,
      headerTags: settings.headerTags,
      headerLayout: settings.headerLayout,
      headerBannerUrl: settings.headerBannerUrl,
      headerBannerBlur: settings.headerBannerBlur,
      headerBannerAlign: settings.headerBannerAlign,
      showFooter: settings.showFooter,
      footerLeft: settings.footerLeft,
      footerCenter: settings.footerCenter,
      footerRight: settings.footerRight,
      showBubble: settings.showBubble,
      embedImagesAsBlob: false,
      globalSettings,
      isForExport: true,
      isForArca: true,
    });

    const tempDiv = document.createElement("div");
    tempDiv.innerHTML = logHtml;

    const collectedImages: ArcaImage[] = [];
    const placeholdersByUrl = new Map<string, string>();
    let mediaCounter = 0;

    const registerMedia = (
      url: string,
      isWebM: boolean,
      extension: string,
    ): string => {
      const existing = placeholdersByUrl.get(url);
      if (existing) return existing;

      mediaCounter++;
      const placeholder = `__TOLOG_MEDIA_${mediaCounter}__`;
      const filename = `${String(mediaCounter).padStart(3, "0")}.${extension}`;
      placeholdersByUrl.set(url, placeholder);
      collectedImages.push({ url, filename, isWebM, placeholder });
      return placeholder;
    };

    // 1. Process inline CSS backgrounds (e.g. cover & banner headers)
    const backgroundElements = Array.from(
      tempDiv.querySelectorAll<HTMLElement>('[style*="background"]'),
    );
    for (const element of backgroundElements) {
      let backgroundImage = element.style.backgroundImage;
      if (!backgroundImage) continue;

      for (const backgroundUrl of getCssImageUrls(backgroundImage)) {
        const urlLower = backgroundUrl.toLowerCase();
        const isWebM =
          urlLower.includes(".webm") || urlLower.includes("data:video/webm");
        const extension =
          isWebM && settings.convertWebM
            ? "webp"
            : getMediaExtension(backgroundUrl);
        const placeholder = registerMedia(backgroundUrl, isWebM, extension);
        backgroundImage = backgroundImage
          .split(backgroundUrl)
          .join(placeholder);
      }
      element.style.backgroundImage = backgroundImage;
    }

    // 2. Process media elements (img, video, source, poster)
    const mediaElements = Array.from(tempDiv.querySelectorAll("img, video"));

    for (const el of mediaElements) {
      const isVideo = el.tagName === "VIDEO";
      const src = isVideo
        ? (el as HTMLVideoElement).querySelector("source")?.src ||
          (el as HTMLVideoElement).src
        : (el as HTMLImageElement).src;

      if (!src) continue;

      const urlLower = src.toLowerCase();
      const isWebM =
        urlLower.includes(".webm") ||
        urlLower.includes("data:video/webm") ||
        urlLower.includes("2e7765626d");
      const sourceExtension =
        (el as HTMLElement).dataset.extension || getMediaExtension(src);
      const extension =
        isWebM && settings.convertWebM ? "webp" : sourceExtension;
      const placeholder = registerMedia(src, isWebM, extension);

      if (isVideo) {
        const video = el as HTMLVideoElement;
        if (video.poster) {
          const posterPlaceholder = registerMedia(
            video.poster,
            false,
            getMediaExtension(video.poster),
          );
          video.poster = posterPlaceholder;
        }
        video.src = placeholder;
        const source = el.querySelector("source");
        if (source) source.src = placeholder;
      } else {
        (el as HTMLImageElement).src = placeholder;
      }
    }

    return {
      html: tempDiv.innerHTML,
      images: collectedImages,
    };
  }, [messageNodes, charInfo, settings, globalSettings, colorPalette]);

  /**
   * Generates ZIP archive for manual upload workflow.
   */
  const generateInitialFiles = useCallback(async () => {
    setIsProcessing(true);
    setTransferMethod("manual");
    setLastMethod("manual");
    setProcessingError(null);
    setError(null);
    setProcessingProgress({
      message: "이미지 파일을 모아 ZIP으로 압축하는 중...",
      current: 0,
      total: 0,
      filename: "",
    });

    try {
      const generated = await collectExportContent();
      setBaseHtml(generated.html);
      setImages(generated.images);

      if (generated.images.length > 0) {
        const blob = await createZipFromMediaList(generated.images, {
          convertWebM: Boolean(settings.convertWebM),
        });
        const safeCharName = sanitizeFilename(charInfo.name || "Character");
        const zipFilename = `Arca_Images_${safeCharName}.zip`;
        const link = document.createElement("a");
        link.href = URL.createObjectURL(blob);
        link.download = zipFilename;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(link.href);
      }

      if (generated.images.length === 0) {
        setFinalHtml(generated.html);
        setStep("done");
      } else {
        setStep("paste_urls");
      }
    } catch (e: unknown) {
      console.error("[Arca Helper] Manual ZIP creation failed:", e);
      setProcessingError(
        `파일 생성 중 오류가 발생했습니다: ${extractErrorMessage(e)}`,
      );
    } finally {
      setIsProcessing(false);
      setProcessingProgress(null);
    }
  }, [collectExportContent, charInfo.name, settings.convertWebM]);

  /**
   * Uploads media automatically via User Proxy or Direct Arca endpoint.
   */
  const generateWithAutomaticUpload = useCallback(
    async (method: "proxy" | "direct") => {
      if (method === "proxy" && !isArcaProxyConfigured(proxyConfig)) {
        setError(
          "플러그인 설정에서 사용자 프록시 URL과 인증 토큰을 먼저 저장해 주세요.",
        );
        return;
      }

      setIsProcessing(true);
      setTransferMethod(method);
      setLastMethod(method);
      setError(null);
      setProcessingError(null);
      setProcessingProgress({
        message:
          method === "proxy"
            ? "사용자 프록시 업로드를 준비하는 중..."
            : "아카라이브 직접 업로드를 준비하는 중...",
        current: 0,
        total: 0,
        filename: "",
      });

      try {
        const generated = await collectExportContent();
        setBaseHtml(generated.html);
        setImages(generated.images);

        const uploadedUrls = await uploadMediaToArca(generated.images, {
          convertWebM: Boolean(settings.convertWebM),
          proxy: method === "proxy" ? proxyConfig : undefined,
          onProgress: ({ current, total, filename }) => {
            const isFinished = current >= total;
            const actionLabel =
              method === "proxy" ? "사용자 프록시로" : "아카라이브에 직접";
            setProcessingProgress({
              current,
              total,
              filename,
              message: isFinished
                ? "업로드 결과를 HTML에 연결하는 중..."
                : `${actionLabel} 업로드 중 (${current + 1}/${total}) ${filename}`,
            });
          },
        });

        setFinalHtml(
          replaceImagePlaceholders(
            generated.html,
            generated.images,
            uploadedUrls,
          ),
        );
        setStep("done");
      } catch (e: unknown) {
        console.error("[Arca Helper] Automatic upload failed:", e);
        setProcessingError(
          `자동 업로드에 실패했습니다: ${extractErrorMessage(e)}`,
        );
      } finally {
        setIsProcessing(false);
        setProcessingProgress(null);
      }
    },
    [collectExportContent, proxyConfig, settings.convertWebM],
  );

  /**
   * Generates self-contained HTML with Base64 embedded images.
   */
  const generateWithBase64 = useCallback(async () => {
    setIsProcessing(true);
    setTransferMethod("base64");
    setLastMethod("base64");
    setError(null);
    setProcessingError(null);
    setProcessingProgress({
      message: "Base64 인라인 이미지 데이터를 생성하는 중...",
      current: 0,
      total: 0,
      filename: "",
    });

    try {
      const logHtml = await getLogHtml({
        nodes: messageNodes,
        charInfo,
        selectedThemeKey: settings.theme,
        color: colorPalette,
        showAvatar: settings.showAvatar,
        showHeader: settings.showHeader,
        showHeaderIcon: settings.showHeaderIcon,
        headerTags: settings.headerTags,
        headerLayout: settings.headerLayout,
        headerBannerUrl: settings.headerBannerUrl,
        headerBannerBlur: settings.headerBannerBlur,
        headerBannerAlign: settings.headerBannerAlign,
        showFooter: settings.showFooter,
        footerLeft: settings.footerLeft,
        footerCenter: settings.footerCenter,
        footerRight: settings.footerRight,
        showBubble: settings.showBubble,
        embedImagesAsBlob: true,
        globalSettings,
        isForExport: true,
        isForArca: true,
      });

      setBaseHtml(logHtml);
      setFinalHtml(logHtml);
      setStep("done");
    } catch (e: unknown) {
      console.error("[Arca Helper] Base64 export failed:", e);
      setProcessingError(
        `Base64 HTML 생성 중 오류가 발생했습니다: ${extractErrorMessage(e)}`,
      );
    } finally {
      setIsProcessing(false);
      setProcessingProgress(null);
    }
  }, [messageNodes, charInfo, settings, globalSettings, colorPalette]);

  /**
   * Generates final HTML from manually pasted ArcaLive <img> tags.
   */
  const handleGenerateFromPasted = useCallback(() => {
    if (!pastedHtml.trim()) {
      setError("아카라이브 HTML 코드를 붙여넣어 주세요.");
      return;
    }
    setError(null);

    const newImageUrls = extractImgSrcs(pastedHtml);

    if (newImageUrls.length !== images.length) {
      setError(
        `이미지 개수가 일치하지 않습니다. 원본 (${images.length}개) vs 붙여넣은 코드 (${newImageUrls.length}개)`,
      );
      return;
    }

    setFinalHtml(replaceImagePlaceholders(baseHtml, images, newImageUrls));
    setStep("done");
  }, [baseHtml, images, pastedHtml]);

  /**
   * Retries the last attempted transfer method.
   */
  const handleRetry = useCallback(() => {
    setProcessingError(null);
    setError(null);
    if (lastMethod === "proxy") {
      void generateWithAutomaticUpload("proxy");
    } else if (lastMethod === "direct") {
      void generateWithAutomaticUpload("direct");
    } else if (lastMethod === "base64") {
      void generateWithBase64();
    } else if (lastMethod === "manual") {
      void generateInitialFiles();
    } else {
      setStep("intro");
    }
  }, [
    generateInitialFiles,
    generateWithAutomaticUpload,
    generateWithBase64,
    lastMethod,
  ]);

  /**
   * Copies the final HTML to clipboard with visual confirmation.
   */
  const handleCopyFinalHtml = useCallback(async () => {
    const success = await copyToClipboard(finalHtml);
    if (success) {
      setHasCopied(true);
      if (copyTimerRef.current) clearTimeout(copyTimerRef.current);
      copyTimerRef.current = setTimeout(() => {
        setHasCopied(false);
      }, 2000);
    }
  }, [finalHtml]);

  const currentStepNum = step === "intro" ? 0 : step === "paste_urls" ? 1 : 2;

  // Render modal content body according to current state
  const renderContent = () => {
    if (processingError) {
      return (
        <ArcaErrorView
          errorMessage={processingError}
          onRetry={handleRetry}
          onBack={() => setProcessingError(null)}
        />
      );
    }

    if (isProcessing) {
      return (
        <ArcaUploadProgressView
          progress={processingProgress}
          transferMethod={transferMethod}
        />
      );
    }

    switch (step) {
      case "intro":
        return (
          <ArcaMethodSelectStep
            isProxyConfigLoading={isProxyConfigLoading}
            proxyConfig={proxyConfig}
            isProcessing={isProcessing}
            onSelectProxy={() => void generateWithAutomaticUpload("proxy")}
            onSelectDirect={() => void generateWithAutomaticUpload("direct")}
            onSelectBase64={() => void generateWithBase64()}
            onSelectManual={generateInitialFiles}
          />
        );
      case "paste_urls":
        return (
          <ArcaPasteUrlsStep
            images={images}
            pastedHtml={pastedHtml}
            onPastedHtmlChange={setPastedHtml}
            onBack={() => setStep("intro")}
            onGenerate={handleGenerateFromPasted}
          />
        );
      case "done":
        return (
          <ArcaDoneStep
            finalHtml={finalHtml}
            transferMethod={transferMethod}
            imageCount={images.length}
            charName={charInfo.name}
            hasCopied={hasCopied}
            onCopy={handleCopyFinalHtml}
            onRestart={handleRestart}
          />
        );
      default:
        return null;
    }
  };

  if (!isOpen) return null;

  return (
    <div
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
        height: "100vh",
        width: "100vw",
        zIndex: 10001,
        backgroundColor: "rgba(0, 0, 0, 0.7)",
        backdropFilter: "blur(4px)",
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget && !isProcessing) {
          handleClose();
        }
      }}
    >
      <div
        data-theme={uiTheme || "dark"}
        style={{
          maxWidth: "680px",
          width: "92%",
          maxHeight: "90vh",
          display: "flex",
          flexDirection: "column",
          backgroundColor: "var(--card, #121212)",
          color: "var(--foreground, #ffffff)",
          borderRadius: "12px",
          padding: "20px 24px",
          boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.6)",
          border: "1px solid var(--border-color, #27272a)",
          fontFamily:
            "Inter, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <ArcaModalHeader
          onClose={handleClose}
          step={step}
          onRestart={handleRestart}
          isProcessing={isProcessing}
        />

        <div
          className="arca-modal-body"
          style={{
            padding: "16px 0",
            display: "flex",
            flexDirection: "column",
            gap: "14px",
            flex: 1,
            overflowY: "auto",
            minHeight: 0,
          }}
        >
          <Steps
            current={currentStepNum}
            size="small"
            items={[
              { title: "방식 선택" },
              { title: "이미지 연결" },
              { title: "완료 및 복사" },
            ]}
            style={{ marginBottom: "4px" }}
          />

          {error && (
            <Alert
              message={error}
              type="error"
              showIcon
              style={{ fontSize: "0.86rem" }}
            />
          )}

          <div className="arca-content-body">{renderContent()}</div>
        </div>
      </div>
    </div>
  );
};

export default ArcaHelperModal;
