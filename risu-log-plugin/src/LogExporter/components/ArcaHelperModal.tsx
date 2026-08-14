/* eslint-disable @typescript-eslint/no-explicit-any */
import React, { useState, useCallback, useEffect } from "react";
import { createZipFromMediaList } from "../../services/zipService";
import { copyToClipboard, saveAsFile } from "../services/fileService";
import type { CharInfo, ArcaImage } from "../../types";
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
} from "lucide-react";
import ArcaliveMethodCard from "./ArcaliveMethodCard";

interface ArcaHelperModalProps {
  isOpen: boolean;
  onClose: () => void;
  messageNodes: HTMLElement[];
  charInfo: CharInfo;
  settings: any;
  globalSettings: any;
  uiTheme: string;
  colorPalette: any;
}

type Step = "intro" | "paste_urls" | "done";
type TransferMethod = "proxy" | "direct" | "manual" | null;

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
  if (dataMime && mimeExtensions[dataMime]) return mimeExtensions[dataMime];

  try {
    const pathname = new URL(src, window.location.href).pathname;
    const extension = pathname.match(/\.([a-z0-9]{2,5})$/i)?.[1]?.toLowerCase();
    if (extension) return extension === "jpeg" ? "jpg" : extension;
  } catch {
    // Fall back to the element metadata or jpg.
  }
  return fallback;
}

function getCssImageUrls(backgroundImage: string): string[] {
  const urls: string[] = [];
  const urlPattern = /url\(\s*(?:"([^"]*)"|'([^']*)'|([^)]*?))\s*\)/gi;
  let match: RegExpExecArray | null;
  while ((match = urlPattern.exec(backgroundImage)) !== null) {
    const url = (match[1] || match[2] || match[3] || "").trim();
    if (url) urls.push(url);
  }
  return urls;
}

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
  const [step, setStep] = useState<Step>("intro");
  const [baseHtml, setBaseHtml] = useState("");
  const [images, setImages] = useState<ArcaImage[]>([]);
  const [pastedHtml, setPastedHtml] = useState("");
  const [finalHtml, setFinalHtml] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [processingMessage, setProcessingMessage] = useState("");
  const [transferMethod, setTransferMethod] = useState<TransferMethod>(null);
  const [proxyConfig, setProxyConfig] = useState<ArcaProxyConfig>({
    url: "",
    token: "",
  });
  const [isProxyConfigLoading, setIsProxyConfigLoading] = useState(false);
  const [processingError, setProcessingError] = useState<string | null>(null);
  const [lastMethod, setLastMethod] = useState<"proxy" | "direct" | "manual" | null>(null);

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

  const handleRestart = () => {
    setStep("intro");
    setBaseHtml("");
    setImages([]);
    setPastedHtml("");
    setFinalHtml("");
    setError(null);
    setProcessingMessage("");
    setTransferMethod(null);
    setProcessingError(null);
    setLastMethod(null);
  };

  const handleClose = () => {
    handleRestart();
    onClose();
  };

  const handleRetry = () => {
    setProcessingError(null);
    setError(null);
    if (lastMethod === "proxy") {
      void generateWithAutomaticUpload("proxy");
    } else if (lastMethod === "direct") {
      void generateWithAutomaticUpload("direct");
    } else if (lastMethod === "manual") {
      void generateInitialFiles();
    } else {
      setStep("intro");
    }
  };

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

    // 1. Process inline CSS backgrounds first, including banner/cover headers.
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

    // 2. Process other media elements
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

  const generateInitialFiles = useCallback(async () => {
    setIsProcessing(true);
    setProcessingMessage("이미지 파일을 모아 ZIP으로 압축하는 중...");
    setTransferMethod("manual");
    setLastMethod("manual");
    setProcessingError(null);
    setError(null);
    try {
      const generated = await collectExportContent();
      setBaseHtml(generated.html);
      setImages(generated.images);

      if (generated.images.length > 0) {
        const blob = await createZipFromMediaList(generated.images, {
          convertWebM: settings.convertWebM,
        });
        const safeCharName = charInfo.name.replace(/[/?%*:|"<>]/g, "-");
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
    } catch (e: any) {
      console.error("[Arca Helper] Step 1 failed:", e);
      setProcessingError(`파일 생성 중 오류가 발생했습니다: ${e.message}`);
    } finally {
      setIsProcessing(false);
      setProcessingMessage("");
    }
  }, [collectExportContent, charInfo.name, settings.convertWebM]);

  const replaceImagePlaceholders = useCallback(
    (html: string, sourceImages: ArcaImage[], urls: string[]) => {
      let result = html;
      sourceImages.forEach((imageInfo, index) => {
        const replacement = urls[index];
        if (!replacement) return;
        const placeholder =
          imageInfo.placeholder || `__TOLOG_PLACEHOLDER_${imageInfo.url}__`;
        result = result.split(placeholder).join(replacement);
      });
      return result;
    },
    [],
  );

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
      setProcessingMessage(
        method === "proxy"
          ? "사용자 프록시 업로드를 준비하는 중..."
          : "아카라이브 직접 업로드를 준비하는 중...",
      );

      try {
        const generated = await collectExportContent();
        setBaseHtml(generated.html);
        setImages(generated.images);

        const uploadedUrls = await uploadMediaToArca(generated.images, {
          convertWebM: Boolean(settings.convertWebM),
          proxy: method === "proxy" ? proxyConfig : undefined,
          onProgress: ({ current, total, filename }) => {
            setProcessingMessage(
              current >= total
                ? "업로드 결과를 HTML에 연결하는 중..."
                : `${method === "proxy" ? "사용자 프록시로" : "아카라이브에 직접"} 업로드 중 (${current + 1}/${total}) ${filename}`,
            );
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
      } catch (e: any) {
        console.error("[Arca Helper] Automatic upload failed:", e);
        setProcessingError(`자동 업로드에 실패했습니다: ${e.message}`);
      } finally {
        setIsProcessing(false);
        setProcessingMessage("");
      }
    },
    [
      collectExportContent,
      proxyConfig,
      replaceImagePlaceholders,
      settings.convertWebM,
    ],
  );

  const generateFinalHtml = () => {
    if (!pastedHtml) {
      setError("아카라이브 HTML 코드를 붙여넣어 주세요.");
      return;
    }
    setError(null);

    const tempDiv = document.createElement("div");
    tempDiv.innerHTML = pastedHtml;

    const newImageUrls = Array.from(tempDiv.querySelectorAll("img")).map(
      (img) => img.src,
    );

    if (newImageUrls.length !== images.length) {
      setError(
        `이미지 개수가 일치하지 않습니다. 원본 (${images.length}개) vs 붙여넣은 코드 (${newImageUrls.length}개)`,
      );
      return;
    }

    setFinalHtml(replaceImagePlaceholders(baseHtml, images, newImageUrls));
    setStep("done");
  };

  const currentStepNum = step === "intro" ? 0 : step === "paste_urls" ? 1 : 2;

  const renderContent = () => {
    if (processingError) {
      return (
        <Result
          status="error"
          title={<span style={{ color: "var(--text-primary)" }}>업로드 실패</span>}
          subTitle={
            <span style={{ color: "var(--text-secondary)", fontSize: "0.9em" }}>
              {processingError}
            </span>
          }
          extra={[
            <Button
              key="retry"
              type="primary"
              icon={<RotateCcw size={14} />}
              onClick={handleRetry}
            >
              다시 시도
            </Button>,
            <Button key="back" onClick={() => setProcessingError(null)}>
              돌아가기
            </Button>,
          ]}
        />
      );
    }
    if (isProcessing) {
      return (
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            height: "220px",
            gap: "16px",
          }}
        >
          <Spin size="large" />
          <div
            style={{
              fontWeight: "bold",
              fontSize: "1.1em",
              color: "var(--text-primary)",
            }}
          >
            {processingMessage || "처리 중..."}
          </div>
          <div style={{ color: "var(--text-secondary)", fontSize: "0.9em" }}>
            잠시만 기다려주세요.
          </div>
        </div>
      );
    }

    switch (step) {
      case "intro":
        return (
          <div
            className="arca-helper-step"
            style={{ display: "flex", flexDirection: "column", gap: "12px" }}
          >
            <ArcaliveMethodCard
              Icon={Server}
              onClick={() => void generateWithAutomaticUpload("proxy")}
              title="사용자 프록시 업로드"
              description="지정한 프록시 서버를 통해 아카라이브 이미지 서버로 이미지를 업로드합니다."
              loading={isProxyConfigLoading || isProcessing}
              disabled={
                !isProxyConfigLoading && !isArcaProxyConfigured(proxyConfig)
              }
              extra={
                !isProxyConfigLoading && !isArcaProxyConfigured(proxyConfig) ? (
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "6px",
                      marginTop: "10px",
                      paddingLeft: "12px",
                      borderLeft: "2px solid var(--border-color)",
                      fontSize: "0.85em",
                      color: "var(--text-secondary)",
                    }}
                  >
                    <AlertTriangle size={13} />
                    플러그인 설정에서 프록시 URL과 토큰을 먼저 저장해 주세요.
                  </div>
                ) : null
              }
            />
            <ArcaliveMethodCard
              Icon={UploadCloud}
              onClick={() => void generateWithAutomaticUpload("direct")}
              title="Risu 직접 업로드"
              description="별도 프록시 없이 아카라이브 이미지 서버에 직접 업로드합니다. Cloudflare 차단에 유의하세요."
              loading={isProcessing}
            />
            <ArcaliveMethodCard
              Icon={Download}
              onClick={generateInitialFiles}
              title="ZIP 파일 다운로드"
              description="이미지를 담은 ZIP 파일을 다운로드한 뒤 아카라이브 편집기에 수동으로 업로드합니다."
              loading={isProcessing}
            />
          </div>
        );
      case "paste_urls":
        return (
          <div
            className="arca-helper-step"
            style={{ display: "flex", flexDirection: "column", gap: "12px" }}
          >
            <div className="arca-instruction-card">
              <h4 style={{ margin: "0 0 8px 0", fontWeight: "bold" }}>
                2단계: 이미지 URL 붙여넣기
              </h4>
              <p
                style={{
                  margin: 0,
                  fontSize: "0.9em",
                  color: "var(--text-secondary)",
                }}
              >
                압축 푼 이미지들을 아카라이브 글쓰기 창에 업로드한 후, HTML
                코드를 가져오세요.
              </p>
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: "6px",
                  marginTop: "12px",
                  paddingLeft: "12px",
                  borderLeft: "2px solid var(--border-color)",
                  fontSize: "0.9em",
                }}
              >
                <div>
                  1. 아카라이브 편집기를 <b>HTML 모드</b>로 전환합니다.
                </div>
                <div>
                  2. 업로드된 이미지 태그(<code>{"<img>"}</code>) 전체를
                  복사합니다.
                </div>
              </div>
            </div>
            <Input.TextArea
              className="arca-paste-area"
              value={pastedHtml}
              onChange={(e) => setPastedHtml(e.target.value)}
              placeholder="여기에 아카라이브 편집기에서 복사한 <img> 태그들을 붙여넣으세요..."
              autoSize={{ minRows: 6, maxRows: 12 }}
              style={{ fontFamily: "monospace", fontSize: "0.9em" }}
            />
          </div>
        );
      case "done":
        return (
          <div
            className="arca-helper-step"
            style={{ display: "flex", flexDirection: "column", gap: "12px" }}
          >
            <div className="arca-instruction-card">
              <h4 style={{ margin: "0 0 8px 0", fontWeight: "bold" }}>
                3단계: 최종 HTML 복사
              </h4>
              <p
                style={{
                  margin: 0,
                  fontSize: "0.9em",
                  color: "var(--text-secondary)",
                }}
              >
                {transferMethod === "proxy" || transferMethod === "direct"
                  ? "이미지 업로드와 URL 연결이 끝났습니다. 아래 코드를 아카라이브 HTML 편집기에 붙여넣으세요."
                  : "완성되었습니다! 아래 코드를 아카라이브 HTML 편집기에 그대로 붙여넣으세요."}
              </p>
            </div>
            <Input.TextArea
              className="arca-paste-area"
              value={finalHtml}
              readOnly
              autoSize={{ minRows: 6, maxRows: 12 }}
              style={{ fontFamily: "monospace", fontSize: "0.9em" }}
              onClick={(e) => (e.target as HTMLTextAreaElement).select()}
            />
          </div>
        );
      default:
        return null;
    }
  };
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
      }}
    >
      <div
        data-theme={uiTheme || "dark"}
        style={{
          maxWidth: "650px",
          width: "90%",
          maxHeight: "90vh",
          display: "flex",
          flexDirection: "column",
          backgroundColor: "#121212",
          borderRadius: "12px",
          padding: "24px",
          boxShadow: "0 25px 50px -12px rgba(0,0,0,0.5)",
        }}
      >
        <header
          style={{
            display: "flex",
            flexDirection: "row",
            alignItems: "center",
          }}
        >
          <h3 style={{ margin: 0 }}>아카라이브 내보내기</h3>
          <div style={{ flex: 1 }}></div>
          <Button
            style={{
              height: "32px",
              width: "32px",
              margin: "0",
              borderRadius: "8px",
              padding: "4px",
            }}
            onClick={handleClose}
          >
            <X></X>
          </Button>
        </header>
        <div
          className="arca-modal-body"
          style={{
            padding: "16px 0",
            display: "flex",
            flexDirection: "column",
            gap: "16px",
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
              { title: "완료" },
            ]}
            style={{ marginBottom: "8px" }}
          />

          {error && (
            <Alert
              message={error}
              type="error"
              showIcon
              style={{ fontSize: "0.9em" }}
            />
          )}

          <div className="arca-content-body">{renderContent()}</div>
        </div>
        <footer style={{ height: "48px" }}>
          {step === "paste_urls" && (
            <Button
              key="html"
              type="primary"
              icon={<FilePlus size={14} />}
              onClick={generateFinalHtml}
            >
              최종 HTML 생성
            </Button>
          )}
          {step === "done" && (
            <Button
              key="save-html"
              icon={<Download size={14} />}
              onClick={() => {
                const safeCharName = charInfo.name.replace(/[/?%*:|"<>]/g, "-");
                saveAsFile(`Arca_HTML_${safeCharName}.txt`, finalHtml);
              }}
            >
              HTML 소스 저장
            </Button>
          )}
          {step === "done" && (
            <Button
              key="copy"
              type="primary"
              style={{ color: "#fff" }}
              icon={<Copy size={14} />}
              onClick={() => copyToClipboard(finalHtml)}
            >
              복사
            </Button>
          )}
        </footer>
      </div>
    </div>
  );
};

export default ArcaHelperModal;
