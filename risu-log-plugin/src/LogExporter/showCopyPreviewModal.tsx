import React, { useState, useCallback, useMemo, useEffect, useRef } from 'react';
import ReactDOM from 'react-dom/client';
import '../index.css';
import './showCopyPreviewModal.css';
import type { RisuCharacter } from '../types/risuai';
import type { ColorPalette, GlobalSettings, LogContainerProps } from '../types';
import { Spin, Button, message, Toaster } from '../components/ui';

import MobileView from './components/mobile/MobileView';
import DesktopView from './components/desktop/DesktopView';
import ArcaHelperModal from './components/ArcaHelperModal';
import { THEMES, COLORS, CHAT_CONTENT_SELECTOR } from './components/constants';
import { clearBlobUrlCache } from './utils/imageUtils';
import { saveAsFile } from './services/fileService';
import { loadGlobalSettings } from './services/settingsService';
import {
  generateMarkdownLog,
  generateTextLog,
  generateHtmlPreview,
} from './services/logGenerator';
import { getLogHtml } from './services/htmlGenerator';
import { processChatLog, serializeNodes } from '../services/chatData';
import { collectUIClasses, getNameFromNode, type UIClassInfo } from './utils/domUtils';

// Hooks
import type { LogExporterSettings, CharInfoState, EstimatedImageSize, UseLogDataOptions } from './hooks/types';
import { useWindowWidth } from './hooks/useWindowWidth';
import { useProgress } from './hooks/useProgress';
import { useSelection } from './hooks/useSelection';
import { useSettings } from './hooks/useSettings';
import { useImageSizeWarning } from './hooks/useImageSizeWarning';
import { useFilteredNodes } from './hooks/useLogData';
import { useTheme, MODAL_ROOT_ELEMENT_ID } from './hooks/useTheme';

// Re-export types
export type { LogExporterSettings, CharInfoState, EstimatedImageSize } from './hooks/types';

// ─── Types & Interfaces ──────────────────────────────────────────────────────

/**
 * Input options for opening the log copy preview modal.
 */
export interface ShowCopyPreviewModalOptions extends UseLogDataOptions {
  [key: string]: unknown;
}

/**
 * Internal state for the modal's loaded chat log data and status.
 */
interface ModalState {
  charInfo: CharInfoState;
  messageNodes: HTMLElement[];
  character: RisuCharacter | null;
  participants: Set<string>;
  uiClasses: UIClassInfo[];
  preCollectedAvatarMap: Map<string, string>;
  isLoading: boolean;
  error: string | null;
}

// ─── Constants & Formatting Helpers ──────────────────────────────────────────

/** Breakpoint for switching between mobile and desktop layout */
const MOBILE_BREAKPOINT_PX = 1024;

/** Extra CSS appended to HTML preview for responsive tables and asset rendering */
const HTML_PREVIEW_EXTRA_STYLES = `
  #log-html-preview-container {
    width: 100% !important;
    max-width: 100% !important;
    box-sizing: border-box !important;
    margin: 0 auto !important;
  }
  #log-html-scaler {
    width: 100% !important;
    box-sizing: border-box !important;
  }
  .x-risu-asset-table,
  .x-risu-asset-table table {
    width: 100% !important;
    table-layout: fixed !important;
    word-break: break-all;
  }
  .x-risu-asset-table img {
    max-width: 100% !important;
    height: auto !important;
    display: block;
    margin: 0 auto;
  }
`;

/**
 * Applies responsive styling overrides to generated HTML log previews.
 */
function enhanceHtmlPreview(html: string): string {
  if (html.includes('</style>')) {
    return html.replace('</style>', `${HTML_PREVIEW_EXTRA_STYLES}\n  </style>`);
  }
  return `<style>${HTML_PREVIEW_EXTRA_STYLES}</style>${html}`;
}

/**
 * Wraps plain text or markdown output in a styled preview container.
 */
function wrapTextInPreviewContainer(content: string, fontSize = 16, maxWidth = 800): string {
  const containerStyle = [
    `font-size: ${fontSize}px`,
    `max-width: ${maxWidth}px`,
    'margin: 0 auto',
    'padding: 20px',
    'background-color: var(--card)',
    'color: var(--foreground)',
    'border: 1px solid var(--border)',
    'border-radius: 8px',
    'box-sizing: border-box',
  ].join('; ');

  const preStyle = 'white-space: pre-wrap; word-wrap: break-word; margin: 0; font-family: monospace;';
  return `<div style="${containerStyle}"><pre style="${preStyle}">${content}</pre></div>`;
}

/**
 * Converts an array of serialized HTML strings into HTMLElement DOM instances.
 */
function parseHtmlToElements(htmlStrings: string[]): HTMLElement[] {
  const nodes: HTMLElement[] = [];
  for (const html of htmlStrings) {
    const container = document.createElement('div');
    container.innerHTML = html;
    if (container.firstElementChild) {
      nodes.push(container.firstElementChild as HTMLElement);
    } else {
      nodes.push(container);
    }
  }
  return nodes;
}

// ─── Data Loading Helper ─────────────────────────────────────────────────────

/**
 * Asynchronously loads and processes the chat log messages, metadata, and participant info.
 */
async function loadModalData(
  options: ShowCopyPreviewModalOptions,
  globalSettings: GlobalSettings,
): Promise<Omit<ModalState, 'isLoading' | 'error'>> {
  const {
    charName,
    chatName,
    charAvatarUrl,
    messageNodes: safeNodes,
    character,
    avatarMap,
  } = await processChatLog(undefined, {
    startIndex: options.startIndex,
    endIndex: options.endIndex,
    singleMessage: options.singleMessage,
  });

  const htmlStrings = await serializeNodes(safeNodes);
  const nodes = parseHtmlToElements(htmlStrings);

  const preCollectedAvatarMap = new Map<string, string>();
  if (avatarMap) {
    Object.entries(avatarMap).forEach(([k, v]) => {
      if (v != null) preCollectedAvatarMap.set(k, String(v));
    });
  }

  const participants = new Set<string>();
  nodes.forEach((node) => {
    const name = getNameFromNode(node, globalSettings, charName);
    if (name) participants.add(name);
  });

  return {
    charInfo: { charName, chatName, charAvatarUrl },
    messageNodes: nodes,
    character,
    participants,
    uiClasses: collectUIClasses(nodes),
    preCollectedAvatarMap,
  };
}

// ─── Props Builder ───────────────────────────────────────────────────────────

/**
 * Constructs the property payload for the LogContainer preview component.
 */
function buildLogContainerProps(
  nodes: HTMLElement[],
  charInfo: CharInfoState,
  settings: LogExporterSettings,
  globalSettings: GlobalSettings,
  colorPalette: ColorPalette,
  handleMessageUpdate: (index: number, newHtml: string) => void,
  preCollectedAvatarMap: Map<string, string>,
): Omit<LogContainerProps, 'onReady'> {
  return {
    nodes,
    charInfo: {
      name: charInfo.charName,
      chatName: charInfo.chatName,
      avatarUrl: charInfo.charAvatarUrl,
    },
    selectedThemeKey: settings.theme,
    selectedColorKey: settings.color,
    color: colorPalette,
    customCss: settings.customCss,
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
    fontSize: settings.htmlScaleFactor !== undefined
      ? 16 * settings.htmlScaleFactor
      : settings.previewFontSize,
    containerWidth: settings.previewWidth,
    imageScale: settings.imageScale,
    imageAlign: settings.imageAlign,
    imageStyle: settings.imageStyle,
    imageCropActive: settings.imageCropActive,
    imageCropAspectRatio: settings.imageCropAspectRatio,
    imageCropVAlign: settings.imageCropVAlign,
    imageCropHAlign: settings.imageCropHAlign,
    imageCropHeight: settings.imageCropHeight,
    isEditable: settings.isEditable,
    onMessageUpdate: handleMessageUpdate,
    replacementRules: settings.replacementRules,
    disableAnimations: settings.disableAnimations,
    isForArca: settings.isForArca,
    allowHtmlRendering: settings.allowHtmlRendering,
    preCollectedAvatarMap,
    avatarPosition: settings.avatarPosition,
    avatarShape: settings.avatarShape,
  };
}

// ─── Main Modal Component ────────────────────────────────────────────────────

export interface ShowCopyPreviewModalProps {
  options?: ShowCopyPreviewModalOptions;
  onClose: () => void;
}

/**
 * Main Log Exporter preview and configuration dialog component.
 */
const ShowCopyPreviewModal: React.FC<ShowCopyPreviewModalProps> = ({
  options = {},
  onClose,
}) => {
  // ── Responsive Layout & Progress ──
  const width = useWindowWidth();
  const isMobile = width <= MOBILE_BREAKPOINT_PX;
  const { progress, startProgress, updateProgress, endProgress } = useProgress();

  // ── Modal Data State ──
  const [modalState, setModalState] = useState<ModalState>({
    charInfo: { charName: '', chatName: '', charAvatarUrl: '' },
    messageNodes: [],
    character: null,
    participants: new Set(),
    uiClasses: [],
    preCollectedAvatarMap: new Map(),
    isLoading: true,
    error: null,
  });

  // ── Settings & Theme ──
  const {
    settings,
    globalSettings,
    handleSettingChange,
    handleGlobalSettingChange,
  } = useSettings(modalState.character);

  const { uiTheme, colorPalette, backgroundColor, closedRef } = useTheme(settings, globalSettings);

  // ── Filtered Nodes & Selection ──
  const finalNodes = useFilteredNodes(
    modalState.messageNodes,
    settings,
    globalSettings,
    modalState.charInfo.charName,
  );

  const selection = useSelection(finalNodes);
  const nodesForExport = useMemo(
    () =>
      selection.selectedIndices.size === 0
        ? finalNodes
        : finalNodes.filter((_, index) => selection.selectedIndices.has(index)),
    [finalNodes, selection.selectedIndices],
  );

  // ── Image Size Estimation & Warnings ──
  const [estimatedImageSize, setEstimatedImageSize] = useState<EstimatedImageSize | null>(null);
  const imageSizeWarning = useImageSizeWarning(estimatedImageSize, settings);

  // ── UI Modal & Panel States ──
  const [isArcaHelperOpen, setIsArcaHelperOpen] = useState(false);
  const [isSettingsDrawerOpen, setIsSettingsDrawerOpen] = useState(false);
  const [activeTab, setActiveTab] = useState('filter');

  // ── Message Content Update Handler ──
  const handleMessageUpdate = useCallback((index: number, newHtml: string) => {
    setModalState((prev) => {
      if (index < 0 || index >= prev.messageNodes.length) {
        return prev;
      }

      const newNodes = [...prev.messageNodes];
      const originalNode = newNodes[index];
      if (!originalNode) return prev;

      const nodeToUpdate = originalNode.cloneNode(true) as HTMLElement;
      const messageEl = nodeToUpdate.querySelector(CHAT_CONTENT_SELECTOR);

      if (messageEl) {
        messageEl.innerHTML = newHtml;
      } else if (nodeToUpdate.matches && nodeToUpdate.matches(CHAT_CONTENT_SELECTOR)) {
        nodeToUpdate.innerHTML = newHtml;
      }

      newNodes[index] = nodeToUpdate;
      return { ...prev, messageNodes: newNodes };
    });
  }, []);

  // ── Initial Chat Data Loading ──
  useEffect(() => {
    let isCancelled = false;

    const init = async () => {
      setModalState((prev) => ({ ...prev, isLoading: true, error: null }));
      try {
        const gs = await loadGlobalSettings();
        const data = await loadModalData(options, gs);
        if (isCancelled) return;
        setModalState((prev) => ({ ...prev, ...data, isLoading: false }));
      } catch (err: unknown) {
        if (isCancelled) return;
        const errorMsg = err instanceof Error ? err.stack || err.message : String(err);
        console.error('[Log Exporter] Modal initialization error:', err);
        setModalState((prev) => ({ ...prev, isLoading: false, error: errorMsg }));
      }
    };

    void init();
    return () => {
      isCancelled = true;
    };
  }, [options]);

  // ── Debounced Format Conversion ──
  const [conversionContent, setConversionContent] = useState('');
  const [converting, setConverting] = useState(false);
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout>>(undefined);

  useEffect(() => {
    if (settings.format === 'basic') {
      setConversionContent('');
      setConverting(false);
      return;
    }

    setConverting(true);
    let isCancelled = false;

    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }

    debounceTimerRef.current = setTimeout(async () => {
      try {
        let content = '';

        if (settings.format === 'html') {
          const rawHtml = await generateHtmlPreview(
            nodesForExport as HTMLElement[],
            settings,
            modalState.preCollectedAvatarMap,
          );
          content = enhanceHtmlPreview(rawHtml);
        } else if (settings.format === 'markdown') {
          const rawMd = await generateMarkdownLog(
            nodesForExport as HTMLElement[],
            modalState.charInfo.charName,
            settings,
          );
          content = wrapTextInPreviewContainer(
            rawMd,
            settings.previewFontSize || 16,
            settings.previewWidth || 800,
          );
        } else if (settings.format === 'text') {
          const rawText = await generateTextLog(
            nodesForExport as HTMLElement[],
            modalState.charInfo.charName,
            settings,
          );
          content = wrapTextInPreviewContainer(
            rawText,
            settings.previewFontSize || 16,
            settings.previewWidth || 800,
          );
        }

        if (!isCancelled) {
          setConversionContent(content);
        }
      } catch (err) {
        if (!isCancelled) {
          console.error('[Log Exporter] Format conversion error:', err);
        }
      } finally {
        if (!isCancelled) {
          setConverting(false);
        }
      }
    }, 300);

    return () => {
      isCancelled = true;
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
    };
  }, [
    nodesForExport,
    settings,
    modalState.charInfo.charName,
    modalState.preCollectedAvatarMap,
  ]);

  // ── Export Content Builder ──
  const getPreviewContentForExport = useCallback(async (): Promise<string> => {
    if (settings.format === 'basic') {
      return await getLogHtml({
        ...buildLogContainerProps(
          nodesForExport as HTMLElement[],
          modalState.charInfo,
          settings,
          globalSettings,
          colorPalette,
          handleMessageUpdate,
          modalState.preCollectedAvatarMap,
        ),
        isEditable: false,
        embedImagesAsBlob: true,
      });
    }

    if (settings.format === 'html') {
      const htmlLog = await generateHtmlPreview(
        nodesForExport as HTMLElement[],
        settings,
        modalState.preCollectedAvatarMap,
      );
      return enhanceHtmlPreview(htmlLog);
    }

    return conversionContent;
  }, [
    settings,
    nodesForExport,
    modalState.charInfo,
    globalSettings,
    colorPalette,
    handleMessageUpdate,
    modalState.preCollectedAvatarMap,
    conversionContent,
  ]);

  // ── File I/O (JSON Backup & Restore) ──
  const handleSaveLogData = useCallback(() => {
    try {
      const data = {
        charName: modalState.charInfo.charName,
        chatName: modalState.charInfo.chatName,
        charAvatarUrl: modalState.charInfo.charAvatarUrl,
        messageNodes: modalState.messageNodes.map((node) => node.outerHTML),
      };
      const content = JSON.stringify(data, null, 2);
      const safeCharName = modalState.charInfo.charName.replace(/[\\/?%*:|"<>]/g, '-');
      const safeChatName = modalState.charInfo.chatName.replace(/[\\/?%*:|"<>]/g, '-');
      const filename = `Risu_Log_Data_${safeCharName || 'Character'}_${safeChatName || 'Chat'}.json`;
      saveAsFile(filename, content, 'application/json;charset=utf-8');
    } catch (err) {
      console.error('[Log Exporter] Failed to save JSON log data:', err);
      message.error('로그 데이터 저장 중 오류가 발생했습니다.');
    }
  }, [modalState.charInfo, modalState.messageNodes]);

  const handleLoadLogData = useCallback(() => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json,application/json';
    input.style.display = 'none';

    const cleanupInput = () => {
      if (input.parentNode) {
        input.parentNode.removeChild(input);
      }
    };

    input.addEventListener('change', async () => {
      try {
        const file = input.files?.[0];
        cleanupInput();
        if (!file) return;

        const content = await file.text();
        const data = JSON.parse(content);

        if (
          typeof data.charName === 'string' &&
          typeof data.chatName === 'string' &&
          Array.isArray(data.messageNodes)
        ) {
          const newNodes = parseHtmlToElements(data.messageNodes);
          setModalState((prev) => ({
            ...prev,
            charInfo: {
              charName: data.charName,
              chatName: data.chatName,
              charAvatarUrl: typeof data.charAvatarUrl === 'string' ? data.charAvatarUrl : '',
            },
            messageNodes: newNodes,
          }));
          message.success('로그 데이터를 성공적으로 불러왔습니다.');
        } else {
          message.error('잘못된 형식의 로그 데이터 파일입니다.');
        }
      } catch (err) {
        console.error('[Log Exporter] Failed to load JSON log data:', err);
        message.error('로그 데이터 파일을 읽는 데 실패했습니다.');
      }
    });

    input.addEventListener('cancel', cleanupInput);

    document.body.appendChild(input);
    input.click();
  }, []);

  // ── Selected Message Deletion ──
  const handleDeleteSelected = useCallback(() => {
    const newNodes = selection.deleteSelected();
    setModalState((prev) => ({ ...prev, messageNodes: newNodes }));
  }, [selection]);

  // ── Modal Close Handler ──
  const handleClose = useCallback(async () => {
    if (closedRef.current) return;
    closedRef.current = true;
    clearBlobUrlCache();

    try {
      if (typeof Risuai !== 'undefined' && Risuai.hideContainer) {
        await Risuai.hideContainer();
      }
    } catch (err) {
      console.warn('[Log Exporter] Risuai.hideContainer error during close:', err);
    }

    onClose();
  }, [closedRef, onClose]);

  // ── ESC Key Listener ──
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        void handleClose();
      }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [handleClose]);

  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      void handleClose();
    }
  };

  // ── Memoized LogContainer Props ──
  const logContainerProps = useMemo(
    () =>
      buildLogContainerProps(
        finalNodes as unknown as HTMLElement[],
        modalState.charInfo,
        settings,
        globalSettings,
        colorPalette,
        handleMessageUpdate,
        modalState.preCollectedAvatarMap,
      ),
    [
      finalNodes,
      modalState.charInfo,
      settings,
      globalSettings,
      colorPalette,
      handleMessageUpdate,
      modalState.preCollectedAvatarMap,
    ],
  );

  // ── Error View ──
  if (modalState.error) {
    return (
      <>
        <Toaster />
        <div className="log-exporter-modal-backdrop" onClick={handleBackdropClick}>
          <div
            className="log-exporter-modal"
            data-theme={uiTheme}
            onClick={(e) => e.stopPropagation()}
            style={{
              padding: '24px',
              maxWidth: '600px',
              margin: '40px auto',
              overflowY: 'auto',
            }}
          >
            <h3 style={{ color: '#ff4d4f', margin: '0 0 12px 0' }}>[Log Exporter] 오류 발생</h3>
            <pre
              style={{
                whiteSpace: 'pre-wrap',
                wordBreak: 'break-all',
                backgroundColor: 'var(--bg-secondary)',
                color: 'var(--text-color)',
                padding: '12px',
                border: '1px solid var(--border-color)',
                borderRadius: '4px',
                maxHeight: '400px',
                overflowY: 'auto',
              }}
            >
              {modalState.error}
            </pre>
            <Button type="primary" danger onClick={handleClose}>
              닫기
            </Button>
          </div>
        </div>
      </>
    );
  }

  // ── Main Render ──
  return (
    <>
      <Toaster />
      <div className="log-exporter-modal-backdrop" onClick={handleBackdropClick}>
        {!isArcaHelperOpen && (
          <div
            className="log-exporter-modal"
            data-theme={uiTheme}
            onClick={(e) => e.stopPropagation()}
          >
            {modalState.isLoading ? (
              <div
                className="desktop-modal-loading"
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  width: '100%',
                  height: '100%',
                  minHeight: '300px',
                  flex: 1,
                  gap: '12px',
                }}
              >
                <Spin size="large" />
                <p>로그 데이터를 불러오는 중...</p>
              </div>
            ) : isMobile ? (
              <MobileView
                charInfo={modalState.charInfo}
                settings={settings}
                globalSettings={globalSettings}
                onSettingChange={handleSettingChange}
                onGlobalSettingChange={handleGlobalSettingChange}
                logContainerProps={logContainerProps}
                otherFormatContent={conversionContent}
                selectedIndices={selection.selectedIndices}
                onSelectionChange={selection.handleSelectionChange}
                lastSelectedIndex={selection.lastSelectedIndex}
                onLastSelectedIndexChange={selection.handleLastSelectedIndexChange}
                onSelectAll={selection.selectAll}
                onDeselectAll={selection.deselectAll}
                onInvertSelection={selection.invertSelection}
                onDimensionsChange={setEstimatedImageSize}
                isConverting={converting}
                themes={THEMES}
                colors={COLORS}
                backgroundColor={backgroundColor}
                colorPalette={colorPalette}
                uiTheme={uiTheme}
                onClose={handleClose}
                getPreviewContentForExport={getPreviewContentForExport}
                nodesForExport={nodesForExport as HTMLElement[]}
                onOpenArcaHelper={() => setIsArcaHelperOpen(true)}
                onProgressStart={startProgress}
                onProgressUpdate={updateProgress}
                onProgressEnd={endProgress}
                onSaveLogData={handleSaveLogData}
                onLoadLogData={handleLoadLogData}
                onDeleteSelected={handleDeleteSelected}
                hasSelection={selection.hasSelection}
                participants={modalState.participants}
                uiClasses={modalState.uiClasses}
                imageSizeWarning={imageSizeWarning}
                activeTab={activeTab}
                onTabChange={setActiveTab}
                isSettingsDrawerOpen={isSettingsDrawerOpen}
                setIsSettingsDrawerOpen={setIsSettingsDrawerOpen}
              />
            ) : (
              <DesktopView
                charInfo={modalState.charInfo}
                settings={settings}
                globalSettings={globalSettings}
                onSettingChange={handleSettingChange}
                onGlobalSettingChange={handleGlobalSettingChange}
                logContainerProps={logContainerProps}
                otherFormatContent={conversionContent}
                selectedIndices={selection.selectedIndices}
                onSelectionChange={selection.handleSelectionChange}
                lastSelectedIndex={selection.lastSelectedIndex}
                onLastSelectedIndexChange={selection.handleLastSelectedIndexChange}
                onSelectAll={selection.selectAll}
                onDeselectAll={selection.deselectAll}
                onInvertSelection={selection.invertSelection}
                onDimensionsChange={setEstimatedImageSize}
                isConverting={converting}
                themes={THEMES}
                colors={COLORS}
                backgroundColor={backgroundColor}
                colorPalette={colorPalette}
                onClose={handleClose}
                getPreviewContentForExport={getPreviewContentForExport}
                nodesForExport={nodesForExport as HTMLElement[]}
                onOpenArcaHelper={() => setIsArcaHelperOpen(true)}
                onProgressStart={startProgress}
                onProgressUpdate={updateProgress}
                onProgressEnd={endProgress}
                onSaveLogData={handleSaveLogData}
                onLoadLogData={handleLoadLogData}
                onDeleteSelected={handleDeleteSelected}
                hasSelection={selection.hasSelection}
                participants={modalState.participants}
                uiClasses={modalState.uiClasses}
                imageSizeWarning={imageSizeWarning}
                activeTab={activeTab}
                onTabChange={setActiveTab}
              />
            )}
          </div>
        )}

        {/* Progress Overlay */}
        {progress.active && (
          <div className="progress-overlay">
            <div className="progress-card">
              <Spin size="large" />
              <p className="progress-message">{progress.message}</p>
              {progress.total > 0 && (
                <span className="progress-count">
                  {progress.current} / {progress.total}
                </span>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Arca Helper Modal */}
      {isArcaHelperOpen && (
        <ArcaHelperModal
          isOpen={isArcaHelperOpen}
          onClose={() => setIsArcaHelperOpen(false)}
          messageNodes={nodesForExport as HTMLElement[]}
          charInfo={{
            name: modalState.charInfo.charName,
            chatName: modalState.charInfo.chatName,
            avatarUrl: modalState.charInfo.charAvatarUrl,
          }}
          settings={settings}
          globalSettings={globalSettings}
          uiTheme={uiTheme}
          colorPalette={colorPalette}
        />
      )}
    </>
  );
};

// ─── Modal Lifecycle Manager ─────────────────────────────────────────────────

/**
 * Manages mounting, fullscreen iframe display, and cleanup of the Log Exporter dialog DOM root.
 */
class ModalManager {
  private root: ReactDOM.Root | null = null;
  private container: HTMLDivElement | null = null;
  private isOpen = false;

  /**
   * Mounts and displays the log exporter preview modal in fullscreen mode.
   */
  async open(options: ShowCopyPreviewModalOptions = {}): Promise<void> {
    // Ensure any previously active instance is cleaned up
    this.cleanup();

    this.container = document.createElement('div');
    this.container.id = MODAL_ROOT_ELEMENT_ID;
    this.container.tabIndex = -1;
    this.container.style.outline = 'none';
    document.body.appendChild(this.container);

    this.root = ReactDOM.createRoot(this.container);
    this.isOpen = true;

    const handleClose = async (): Promise<void> => {
      if (!this.isOpen) return;
      this.isOpen = false;
      try {
        if (typeof Risuai !== 'undefined' && Risuai.hideContainer) {
          await Risuai.hideContainer();
        }
      } catch (err) {
        console.warn('[Log Exporter] Risuai.hideContainer error:', err);
      }
      this.cleanup();
    };

    this.root.render(
      React.createElement(
        React.StrictMode,
        null,
        React.createElement(ShowCopyPreviewModal, {
          options,
          onClose: handleClose,
        }),
      ),
    );

    try {
      if (typeof Risuai !== 'undefined' && Risuai.showContainer) {
        await Risuai.showContainer('fullscreen');
      }
    } catch (err) {
      console.warn('[Log Exporter] Risuai.showContainer error:', err);
    }

    if (typeof window !== 'undefined') {
      window.focus();
    }
    this.container?.focus();
  }

  /**
   * Safely unmounts the React root and removes the modal container element from the DOM.
   */
  cleanup(): void {
    if (this.root) {
      try {
        this.root.unmount();
      } catch (err) {
        console.warn('[Log Exporter] Error unmounting root:', err);
      }
      this.root = null;
    }
    if (this.container) {
      try {
        this.container.remove();
      } catch (err) {
        console.warn('[Log Exporter] Error removing container:', err);
      }
      this.container = null;
    }
    this.isOpen = false;
  }
}

const modalManager = new ModalManager();

/**
 * Shows the log exporter modal in fullscreen iframe mode.
 *
 * @param options Filter options for selected message range or single message export
 */
async function showCopyPreviewModal(
  options: ShowCopyPreviewModalOptions = {},
): Promise<void> {
  await modalManager.open(options);
}

// eslint-disable-next-line react-refresh/only-export-components
export { showCopyPreviewModal };
export default ShowCopyPreviewModal;
