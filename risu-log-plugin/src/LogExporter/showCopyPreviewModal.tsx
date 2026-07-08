import React, { useState, useCallback, useMemo, useEffect, useRef } from 'react';
import ReactDOM from 'react-dom/client';
import './showCopyPreviewModal.css';
import type { RisuCharacter } from '../types/risuai';
import type { ColorPalette, GlobalSettings, LogContainerProps, ThemeInfo } from '../types';
import { ConfigProvider, Spin, Button, Drawer, message } from 'antd';
import { SettingOutlined, CloseOutlined, EditOutlined, LeftOutlined, RightOutlined } from '@ant-design/icons';

import SettingsTabs from './components/SettingsTabs';
import PreviewPanel from './components/PreviewPanel';
import ArcaHelperModal from './components/ArcaHelperModal';
import Actionbar from './components/Actionbar';
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

// Hooks
import type { LogExporterSettings, CharInfoState, EstimatedImageSize } from './hooks/types';
import { useWindowWidth } from './hooks/useWindowWidth';
import { useProgress } from './hooks/useProgress';
import { useSelection } from './hooks/useSelection';
import { useSettings } from './hooks/useSettings';
import { useImageSizeWarning } from './hooks/useImageSizeWarning';
import { useFilteredNodes } from './hooks/useLogData';
import { useTheme } from './hooks/useTheme';

// Re-export types
export type { LogExporterSettings, CharInfoState, EstimatedImageSize } from './hooks/types';

// ─── Modal State Interface ───────────────────────────────────────────────────

interface ModalState {
  charInfo: CharInfoState;
  messageNodes: HTMLElement[];
  character: RisuCharacter | null;
  participants: Set<string>;
  uiClasses: import('./utils/domUtils').UIClassInfo[];
  preCollectedAvatarMap: Map<string, string>;
  isLoading: boolean;
  error: string | null;
}

// ─── Data Loading Helper ─────────────────────────────────────────────────────

async function loadModalData(
  options: Record<string, unknown>,
  globalSettings: GlobalSettings,
): Promise<Omit<ModalState, 'isLoading' | 'error'>> {
  const { processChatLog, serializeNodes } = await import('../services/chatData');
  const { collectUIClasses, getNameFromNode } = await import('./utils/domUtils');

  const {
    charName,
    chatName,
    charAvatarUrl,
    messageNodes: safeNodes,
    character,
    avatarMap,
  } = await processChatLog(undefined, options as { startIndex?: number; endIndex?: number; singleMessage?: boolean });

  const htmlStrings = await serializeNodes(safeNodes);
  const nodes = parseHtmlToElements(htmlStrings);

  const mapObj = new Map<string, string>();
  if (avatarMap) {
    Object.entries(avatarMap).forEach(([k, v]) => mapObj.set(k, String(v)));
  }

  const newParticipants = new Set<string>();
  nodes.forEach((node: HTMLElement) => {
    const name = getNameFromNode(node, globalSettings, charName);
    if (name) newParticipants.add(name);
  });

  return {
    charInfo: { charName, chatName, charAvatarUrl },
    messageNodes: nodes,
    character,
    participants: newParticipants,
    uiClasses: collectUIClasses(nodes),
    preCollectedAvatarMap: mapObj,
  };
}

function parseHtmlToElements(htmlStrings: string[]): HTMLElement[] {
  const nodes: HTMLElement[] = [];
  for (const html of htmlStrings) {
    const tmp = document.createElement('div');
    tmp.innerHTML = html;
    if (tmp.firstElementChild) {
      nodes.push(tmp.firstElementChild as HTMLElement);
    } else {
      nodes.push(tmp);
    }
  }
  return nodes;
}

// ─── Props Builder ───────────────────────────────────────────────────────────

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
    charInfo: { name: charInfo.charName, chatName: charInfo.chatName, avatarUrl: charInfo.charAvatarUrl },
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
    fontSize: settings.htmlScaleFactor !== undefined ? 16 * settings.htmlScaleFactor : settings.previewFontSize,
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

// ─── Sub-Components ──────────────────────────────────────────────────────────

interface HeaderBarProps {
  isMobile: boolean;
  isEditable: boolean;
  onClose: () => void;
  onToggleEditable: () => void;
  onOpenSettingsDrawer: () => void;
}

function HeaderBar({ isMobile, isEditable, onClose, onToggleEditable, onOpenSettingsDrawer }: HeaderBarProps) {
  return (
    <div className="log-exporter-modal-header-bar" style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '12px 16px' }}>
      <Button
        id="log-exporter-close"
        className="log-exporter-modal-close-btn"
        type="text"
        icon={<CloseOutlined />}
        title="닫기 (Esc)"
        aria-label="모달 닫기"
        onClick={onClose}
        style={{ color: 'var(--text-white)' }}
      />
      <span className="header-title" style={{ flex: 1, fontSize: '1.2em', fontWeight: 'bold' }}>로그 플러그인</span>
      <Button
        type="text"
        icon={<EditOutlined />}
        onClick={onToggleEditable}
        style={{ color: isEditable ? 'var(--accent-primary)' : 'var(--text-white)' }}
        title="로그 편집 활성화 토글"
      >
        {!isMobile ? '로그 편집' : null}
      </Button>
      {isMobile && (
        <Button
          type="text"
          icon={<SettingOutlined />}
          onClick={onOpenSettingsDrawer}
          style={{ color: 'var(--text-white)' }}
        >
          설정
        </Button>
      )}
    </div>
  );
}

interface PreviewContentProps {
  logContainerProps: Omit<LogContainerProps, 'onReady'>;
  settings: LogExporterSettings;
  otherFormatContent: string;
  selectedIndices: Set<number>;
  onSelectionChange: (newSelection: Set<number>) => void;
  lastSelectedIndex: number | null;
  onLastSelectedIndexChange: (index: number | null) => void;
  onSelectAll: () => void;
  onDeselectAll: () => void;
  onInvertSelection: () => void;
  onDimensionsChange: (dims: EstimatedImageSize) => void;
  isConverting: boolean;
  onSettingChange: (key: string, value: unknown) => void;
  themes: Record<string, ThemeInfo>;
  colors: Record<string, ColorPalette>;
}

function PreviewContent({
  logContainerProps,
  settings,
  otherFormatContent,
  selectedIndices,
  onSelectionChange,
  lastSelectedIndex,
  onLastSelectedIndexChange,
  onSelectAll,
  onDeselectAll,
  onInvertSelection,
  onDimensionsChange,
  isConverting,
  onSettingChange,
  themes,
  colors,
}: PreviewContentProps) {
  return (
    <PreviewPanel
      logContainerProps={logContainerProps}
      settings={settings}
      otherFormatContent={otherFormatContent}
      selectedIndices={selectedIndices}
      onSelectionChange={onSelectionChange}
      lastSelectedIndex={lastSelectedIndex}
      onLastSelectedIndexChange={onLastSelectedIndexChange}
      onSelectAll={onSelectAll}
      onDeselectAll={onDeselectAll}
      onInvertSelection={onInvertSelection}
      onDimensionsChange={onDimensionsChange}
      isConverting={isConverting}
      onSettingChange={onSettingChange}
      themes={themes}
      colors={colors}
    />
  );
}

interface ActionbarContentProps {
  charName: string;
  chatName: string;
  getPreviewContent: () => Promise<string>;
  messageNodes: HTMLElement[];
  settings: LogExporterSettings;
  backgroundColor: string;
  color: ColorPalette;
  charAvatarUrl: string;
  onOpenArcaHelper: () => void;
  onProgressStart: (message: string, total?: number) => void;
  onProgressUpdate: (update: { current?: number; message?: string }) => void;
  onProgressEnd: () => void;
  onSaveLogData: () => void;
  onLoadLogData: () => void;
  onDeleteSelected?: () => void;
  hasSelection: boolean;
  onSelectAll: () => void;
  onDeselectAll: () => void;
  onInvertSelection: () => void;
}

function ActionbarContent({
  charName,
  chatName,
  getPreviewContent,
  messageNodes,
  settings,
  backgroundColor,
  color,
  charAvatarUrl,
  onOpenArcaHelper,
  onProgressStart,
  onProgressUpdate,
  onProgressEnd,
  onSaveLogData,
  onLoadLogData,
  onDeleteSelected,
  hasSelection,
  onSelectAll,
  onDeselectAll,
  onInvertSelection,
}: ActionbarContentProps) {
  return (
    <Actionbar
      charName={charName}
      chatName={chatName}
      getPreviewContent={getPreviewContent}
      messageNodes={messageNodes}
      settings={settings}
      backgroundColor={backgroundColor}
      color={color}
      charAvatarUrl={charAvatarUrl}
      onOpenArcaHelper={onOpenArcaHelper}
      onProgressStart={onProgressStart}
      onProgressUpdate={onProgressUpdate}
      onProgressEnd={onProgressEnd}
      onSaveLogData={onSaveLogData}
      onLoadLogData={onLoadLogData}
      onDeleteSelected={onDeleteSelected}
      hasSelection={hasSelection}
      onSelectAll={onSelectAll}
      onDeselectAll={onDeselectAll}
      onInvertSelection={onInvertSelection}
    />
  );
}

interface SettingsDrawerProps {
  activeTab: string;
  onTabChange: (tab: string) => void;
  settings: LogExporterSettings;
  onSettingChange: (key: string, value: unknown) => void;
  participants: Set<string>;
  globalSettings: GlobalSettings;
  onGlobalSettingChange: (key: string, value: unknown) => void;
  uiClasses: import('./utils/domUtils').UIClassInfo[];
  imageSizeWarning: string;
  themes: Record<string, ThemeInfo>;
  colors: Record<string, ColorPalette>;
}

function SettingsDrawerContent({
  activeTab,
  onTabChange,
  settings,
  onSettingChange,
  participants,
  globalSettings,
  onGlobalSettingChange,
  uiClasses,
  imageSizeWarning,
  themes,
  colors,
}: SettingsDrawerProps) {
  return (
    <SettingsTabs
      activeTab={activeTab}
      onTabChange={onTabChange}
      settings={settings}
      onSettingChange={onSettingChange}
      participants={participants}
      globalSettings={globalSettings}
      onGlobalSettingChange={onGlobalSettingChange}
      uiClasses={uiClasses}
      imageSizeWarning={imageSizeWarning}
      themes={themes}
      colors={colors}
    />
  );
}

// ─── Main Modal Component ────────────────────────────────────────────────────

interface ShowCopyPreviewModalProps {
  options?: Record<string, unknown>;
  onClose: () => void;
}

const ShowCopyPreviewModal: React.FC<ShowCopyPreviewModalProps> = ({ options = {}, onClose }) => {
  // ── Hooks ──
  const width = useWindowWidth();
  const isMobile = width <= 768;

  const { progress, startProgress, updateProgress, endProgress } = useProgress();

  // ── Modal State ──
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

  // ── Settings ──
  const { settings, globalSettings, handleSettingChange, handleGlobalSettingChange } = useSettings(modalState.character);

  // ── Theme ──
  const { uiTheme, colorPalette, backgroundColor, antdTheme, closedRef } = useTheme(settings, globalSettings);

  // ── Filtered Nodes ──
  const finalNodes = useFilteredNodes(
    modalState.messageNodes,
    settings,
    globalSettings,
    modalState.charInfo.charName,
  );

  // ── Selection ──
  const selection = useSelection(finalNodes);
  const nodesForExport = selection.getFilteredItems();

  // ── Image Size ──
  const [estimatedImageSize, setEstimatedImageSize] = useState<EstimatedImageSize | null>(null);
  const imageSizeWarning = useImageSizeWarning(estimatedImageSize, settings);

  // ── UI State ──
  const [isArcaHelperOpen, setIsArcaHelperOpen] = useState(false);
  const [isSettingsDrawerOpen, setIsSettingsDrawerOpen] = useState(false);
  const [activeTab, setActiveTab] = useState('filter');
  const [isSettingsOpen, setIsSettingsOpen] = useState(true);

  // ── Message Update Handler ──
  const handleMessageUpdate = useCallback((index: number, newHtml: string) => {
    setModalState(prev => {
      const newNodes = [...prev.messageNodes];
      const nodeToUpdate = newNodes[index].cloneNode(true) as HTMLElement;
      const messageEl = nodeToUpdate.querySelector(CHAT_CONTENT_SELECTOR);
      if (messageEl) {
        messageEl.innerHTML = newHtml;
        newNodes[index] = nodeToUpdate;
      }
      return { ...prev, messageNodes: newNodes };
    });
  }, []);

  // ── Data Loading ──
  useEffect(() => {
    let cancelled = false;

    const init = async () => {
      setModalState(prev => ({ ...prev, isLoading: true, error: null }));
      try {
        const gs = await loadGlobalSettings();
        const data = await loadModalData(options, gs);
        if (cancelled) return;
        setModalState(prev => ({ ...prev, ...data, isLoading: false }));
      } catch (err: unknown) {
        if (cancelled) return;
        const errorMsg = err instanceof Error ? err.stack || err.message : String(err);
        console.error('[Log Exporter] Modal open error:', err);
        setModalState(prev => ({ ...prev, isLoading: false, error: errorMsg }));
      }
    };

    init();
    return () => { cancelled = true; };
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
    if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);

    debounceTimerRef.current = setTimeout(async () => {
      try {
        let content: string;

        if (settings.format === 'html') {
          content = await generateHtmlPreview(nodesForExport as HTMLElement[], settings, modalState.preCollectedAvatarMap);
          content = content.replace('</style>', `
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
          </style>`);
        } else if (settings.format === 'markdown') {
          content = await generateMarkdownLog(nodesForExport as HTMLElement[], modalState.charInfo.charName, settings);
        } else if (settings.format === 'text') {
          content = await generateTextLog(nodesForExport as HTMLElement[], modalState.charInfo.charName, settings);
        } else {
          content = '';
        }

        if (settings.format === 'markdown' || settings.format === 'text') {
          const style = `font-size: ${settings.previewFontSize || 16}px; max-width: ${settings.previewWidth || 800}px; margin: 20px auto; padding: 20px; background-color: #1a1b26; color: #c0caf5; border-radius: 8px;`;
          setConversionContent(`<div style="${style}"><pre style="white-space: pre-wrap; word-wrap: break-word;">${content}</pre></div>`);
        } else {
          setConversionContent(content);
        }
      } catch (err) {
        console.error('[Log Exporter] Format conversion error:', err);
      } finally {
        setConverting(false);
      }
    }, 300);

    return () => {
      if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
    };
  }, [finalNodes, selection.selectedIndices, settings, globalSettings, modalState.charInfo.charName, nodesForExport, modalState.preCollectedAvatarMap]);

  // ── Export Content Builder ──
  const getPreviewContentForExport = useCallback(async () => {
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
    } else if (settings.format === 'html') {
      const htmlLog = await generateHtmlPreview(nodesForExport as HTMLElement[], settings, modalState.preCollectedAvatarMap);
      return htmlLog.replace('</style>', `
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
        }
      </style>`);
    }
    return conversionContent;
  }, [settings, nodesForExport, modalState.charInfo, globalSettings, colorPalette, handleMessageUpdate, modalState.preCollectedAvatarMap, conversionContent]);

  // ── File I/O ──
  const handleSaveLogData = useCallback(() => {
    const data = {
      charName: modalState.charInfo.charName,
      chatName: modalState.charInfo.chatName,
      charAvatarUrl: modalState.charInfo.charAvatarUrl,
      messageNodes: modalState.messageNodes.map(node => node.outerHTML),
    };
    const content = JSON.stringify(data, null, 2);
    const safeCharName = modalState.charInfo.charName.replace(/[\\/?%*:|"<>]/g, '-');
    const safeChatName = modalState.charInfo.chatName.replace(/[\\/?%*:|"<>]/g, '-');
    saveAsFile(`Risu_Log_Data_${safeCharName}_${safeChatName}.json`, content, 'application/json;charset=utf-8');
  }, [modalState]);

  const handleLoadLogData = useCallback(async () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json,application/json';
    input.style.display = 'none';
    document.body.appendChild(input);

    input.addEventListener('change', async () => {
      const file = input.files?.[0];
      document.body.removeChild(input);
      if (!file) return;

      const content = await file.text();
      try {
        const data = JSON.parse(content);
        if (data.charName && data.chatName && data.charAvatarUrl && Array.isArray(data.messageNodes)) {
          const newNodes = data.messageNodes.map((html: string) => {
            const tempDiv = document.createElement('div');
            tempDiv.innerHTML = html;
            return tempDiv.firstChild as HTMLElement;
          });
          setModalState(prev => ({
            ...prev,
            charInfo: { charName: data.charName, chatName: data.chatName, charAvatarUrl: data.charAvatarUrl },
            messageNodes: newNodes,
          }));
          message.success('로그 데이터를 성공적으로 불러왔습니다.');
        } else {
          message.error('잘못된 형식의 로그 데이터 파일입니다.');
        }
      } catch {
        message.error('로그 데이터 파일을 읽는 데 실패했습니다.');
      }
    });

    input.click();
  }, []);

  // ── Delete Selected ──
  const handleDeleteSelected = useCallback(() => {
    const newNodes = selection.deleteSelected();
    setModalState(prev => ({ ...prev, messageNodes: newNodes }));
  }, [selection]);

  // ── Close Handler ──
  const handleClose = useCallback(async () => {
    if (closedRef.current) return;
    closedRef.current = true;
    clearBlobUrlCache();
    await Risuai.hideContainer();
    onClose();
  }, [closedRef, onClose]);

  // ── ESC Key Handler ──
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') handleClose();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [handleClose]);

  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) handleClose();
  };

  // ── Log Container Props ──
  const logContainerProps = useMemo(() =>
    buildLogContainerProps(
      finalNodes as unknown as HTMLElement[],
      modalState.charInfo,
      settings,
      globalSettings,
      colorPalette,
      handleMessageUpdate,
      modalState.preCollectedAvatarMap,
    ),
    [finalNodes, modalState.charInfo, settings, globalSettings, colorPalette, handleMessageUpdate, modalState.preCollectedAvatarMap],
  );

  // ── Error View ──
  if (modalState.error) {
    return (
      <ConfigProvider theme={antdTheme}>
        <div className="log-exporter-modal-backdrop" onClick={handleBackdropClick}>
          <div
            className="log-exporter-modal"
            data-theme={uiTheme}
            onClick={(e) => e.stopPropagation()}
            style={{ padding: '24px', maxWidth: '600px', margin: '40px auto', overflowY: 'auto' }}
          >
            <h3 style={{ color: '#ff4d4f', margin: '0 0 12px 0' }}>[Log Exporter] 오류 발생</h3>
            <pre style={{
              whiteSpace: 'pre-wrap',
              wordBreak: 'break-all',
              backgroundColor: 'var(--bg-secondary)',
              color: 'var(--text-color)',
              padding: '12px',
              border: '1px solid var(--border-color)',
              borderRadius: '4px',
              maxHeight: '400px',
              overflowY: 'auto',
            }}>
              {modalState.error}
            </pre>
            <Button type="primary" danger onClick={handleClose}>닫기</Button>
          </div>
        </div>
      </ConfigProvider>
    );
  }

  // ── Render ──
  return (
    <ConfigProvider theme={antdTheme}>
      <div className="log-exporter-modal-backdrop" onClick={handleBackdropClick}>
        {!isArcaHelperOpen && (
          <div className="log-exporter-modal" data-theme={uiTheme} onClick={(e) => e.stopPropagation()}>
            <HeaderBar
              isMobile={isMobile}
              isEditable={settings.isEditable}
              onClose={handleClose}
              onToggleEditable={() => handleSettingChange('isEditable', !settings.isEditable)}
              onOpenSettingsDrawer={() => setIsSettingsDrawerOpen(true)}
            />

            {modalState.isLoading ? (
              <div className="desktop-modal-loading" style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                height: '300px',
                gap: '12px',
              }}>
                <Spin size="large" />
                <p>로그 데이터를 불러오는 중...</p>
              </div>
            ) : isMobile ? (
              /* ── Mobile Layout ── */
              <div className="log-exporter-modal-content mobile-preview-tab" style={{
                height: 'calc(100% - 71px)',
                position: 'relative',
                overflow: 'hidden',
              }}>
                <PreviewContent
                  logContainerProps={logContainerProps}
                  settings={settings}
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
                  onSettingChange={handleSettingChange}
                  themes={THEMES}
                  colors={COLORS}
                />
                <div className="mobile-action-bar">
                  <ActionbarContent
                    charName={modalState.charInfo.charName}
                    chatName={modalState.charInfo.chatName}
                    getPreviewContent={getPreviewContentForExport}
                    messageNodes={nodesForExport as unknown as HTMLElement[]}
                    settings={settings}
                    backgroundColor={backgroundColor}
                    color={colorPalette}
                    charAvatarUrl={modalState.charInfo.charAvatarUrl}
                    onOpenArcaHelper={() => setIsArcaHelperOpen(true)}
                    onProgressStart={startProgress}
                    onProgressUpdate={updateProgress}
                    onProgressEnd={endProgress}
                    onSaveLogData={handleSaveLogData}
                    onLoadLogData={handleLoadLogData}
                    onDeleteSelected={handleDeleteSelected}
                    hasSelection={selection.hasSelection}
                    onSelectAll={selection.selectAll}
                    onDeselectAll={selection.deselectAll}
                    onInvertSelection={selection.invertSelection}
                  />
                </div>
              </div>
            ) : (
              /* ── Desktop Layout ── */
              <div className="log-exporter-modal-content" style={{
                display: 'flex',
                height: 'calc(100% - 71px)',
                overflow: 'hidden',
              }}>
                <div className="desktop-settings-panel" style={{
                  display: 'flex',
                  flexDirection: 'column',
                  height: '100%',
                  width: isSettingsOpen ? '450px' : '0px',
                  borderRight: isSettingsOpen ? '1px solid var(--border-color)' : '0px solid transparent',
                  background: 'var(--bg-secondary)',
                  overflow: 'visible',
                  flexShrink: 0,
                  position: 'relative',
                }}>
                  <div style={{ width: '450px', height: '100%', overflow: 'hidden', display: 'flex', flexDirection: 'column', flexShrink: 0 }}>
                    <SettingsDrawerContent
                      activeTab={activeTab}
                      onTabChange={setActiveTab}
                      settings={settings}
                      onSettingChange={handleSettingChange}
                      participants={modalState.participants}
                      globalSettings={globalSettings}
                      onGlobalSettingChange={handleGlobalSettingChange}
                      uiClasses={modalState.uiClasses}
                      imageSizeWarning={imageSizeWarning}
                      themes={THEMES}
                      colors={COLORS}
                    />
                  </div>
                  <Button
                    className="sidebar-toggle-handle"
                    icon={isSettingsOpen ? <LeftOutlined /> : <RightOutlined />}
                    onClick={() => setIsSettingsOpen(!isSettingsOpen)}
                    style={{
                      position: 'absolute',
                      right: isSettingsOpen ? '-10px' : '-18px',
                      top: '50%',
                      transform: 'translateY(-50%)',
                      zIndex: 100,
                      borderRadius: '0 8px 8px 0',
                      width: '18px',
                      height: '48px',
                      padding: 0,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      borderLeft: 'none',
                      backgroundColor: 'var(--bg-secondary)',
                      borderColor: 'var(--border-color)',
                      color: 'var(--text-secondary)',
                      boxShadow: '2px 0 8px rgba(0, 0, 0, 0.15)',
                    }}
                  />
                </div>
                <div className="desktop-preview-panel" style={{
                  overflow: 'hidden',
                  display: 'flex',
                  flexDirection: 'column',
                  height: '100%',
                  position: 'relative',
                  flex: 1,
                }}>
                  <PreviewContent
                    logContainerProps={logContainerProps}
                    settings={settings}
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
                    onSettingChange={handleSettingChange}
                    themes={THEMES}
                    colors={COLORS}
                  />
                  <div className="desktop-floating-action-bar">
                    <ActionbarContent
                      charName={modalState.charInfo.charName}
                      chatName={modalState.charInfo.chatName}
                      getPreviewContent={getPreviewContentForExport}
                      messageNodes={nodesForExport as unknown as HTMLElement[]}
                      settings={settings}
                      backgroundColor={backgroundColor}
                      color={colorPalette}
                      charAvatarUrl={modalState.charInfo.charAvatarUrl}
                      onOpenArcaHelper={() => setIsArcaHelperOpen(true)}
                      onProgressStart={startProgress}
                      onProgressUpdate={updateProgress}
                      onProgressEnd={endProgress}
                      onSaveLogData={handleSaveLogData}
                      onLoadLogData={handleLoadLogData}
                      onDeleteSelected={handleDeleteSelected}
                      hasSelection={selection.hasSelection}
                      onSelectAll={selection.selectAll}
                      onDeselectAll={selection.deselectAll}
                      onInvertSelection={selection.invertSelection}
                    />
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Progress Overlay */}
        {progress.active && (
          <div className="progress-overlay">
            <div className="progress-card">
              <p className="progress-message">{progress.message}</p>
              {progress.total > 0 && (
                <span className="progress-count">{progress.current} / {progress.total}</span>
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
          messageNodes={modalState.messageNodes}
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

      {/* Mobile Settings Drawer */}
      <Drawer
        title="설정"
        placement="right"
        open={isSettingsDrawerOpen}
        onClose={() => setIsSettingsDrawerOpen(false)}
        width="100%"
        styles={{ body: { padding: 0, background: 'var(--bg-secondary)' } }}
        getContainer={() => document.getElementById('log-exporter-react-modal-root') || document.body}
      >
        <SettingsDrawerContent
          activeTab={activeTab}
          onTabChange={setActiveTab}
          settings={settings}
          onSettingChange={handleSettingChange}
          participants={modalState.participants}
          globalSettings={globalSettings}
          onGlobalSettingChange={handleGlobalSettingChange}
          uiClasses={modalState.uiClasses}
          imageSizeWarning={imageSizeWarning}
          themes={THEMES}
          colors={COLORS}
        />
      </Drawer>
    </ConfigProvider>
  );
};

// ─── Modal Lifecycle Manager ─────────────────────────────────────────────────

class ModalManager {
  private root: ReactDOM.Root | null = null;
  private container: HTMLDivElement | null = null;
  private isOpen = false;

  async open(options: Record<string, unknown> = {}): Promise<void> {
    this.cleanup();

    this.container = document.createElement('div');
    this.container.id = 'log-exporter-react-modal-root';
    document.body.appendChild(this.container);

    this.root = ReactDOM.createRoot(this.container);
    this.isOpen = true;

    const handleClose = async (): Promise<void> => {
      if (!this.isOpen) return;
      this.isOpen = false;
      await Risuai.hideContainer();
      this.cleanup();
    };

    this.root.render(
      React.createElement(React.StrictMode, null,
        React.createElement(ShowCopyPreviewModal, { options, onClose: handleClose }),
      ),
    );

    await Risuai.showContainer('fullscreen');
    window.focus();
    this.container?.focus();
  }

  private cleanup(): void {
    if (this.root) {
      this.root.unmount();
      this.root = null;
    }
    if (this.container) {
      this.container.remove();
      this.container = null;
    }
    this.isOpen = false;
  }
}

const modalManager = new ModalManager();

/**
 * Show the log exporter modal in fullscreen iframe mode.
 * v3.0: iframe DOM에 React 렌더 → Risuai.showContainer('fullscreen')
 */
async function showCopyPreviewModal(options: {
  startIndex?: number;
  endIndex?: number;
  singleMessage?: boolean;
} = {}): Promise<void> {
  await modalManager.open(options);
}

// eslint-disable-next-line react-refresh/only-export-components
export { showCopyPreviewModal };
export default ShowCopyPreviewModal;
