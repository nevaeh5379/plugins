import React, { useState, useEffect, useMemo, useCallback } from 'react';
import ReactDOM from 'react-dom/client';
import './showCopyPreviewModal.css';
import { processChatLog, serializeNodes } from '../services/chatData';
import { THEMES, COLORS } from './components/constants';
import type { RisuCharacter } from '../types/risuai';
import type { ThemeKey, ColorKey } from '../types';
import { ConfigProvider, theme, Spin, Button, Tabs } from 'antd';
import { SettingOutlined, ExportOutlined, FilterOutlined, TranslationOutlined, SlidersOutlined, CloseOutlined, EditOutlined } from '@ant-design/icons';

import PluginSettingsModal from './components/PluginSettingsModal';
import ExportTab from './components/ExportTab';
import FilterTab from './components/FilterTab';
import AdvancedTab from './components/AdvancedTab';
import ReplacementTab from './components/ReplacementTab';
import MobileSettingsPanel from './components/MobileSettingsPanel';
import MobileToolsPanel from './components/MobileToolsPanel';

import PreviewPanel from './components/PreviewPanel';
import ArcaHelperModal from './components/ArcaHelperModal';

import Actionbar from './components/Actionbar';
import { generateMarkdownLog, generateTextLog, generateHtmlPreview } from './services/logGenerator';
import { getLogHtml } from './services/htmlGenerator';
import { collectUIClasses, filterWithCustomClasses, getNameFromNode } from './utils/domUtils';
import type { UIClassInfo } from './utils/domUtils';
import type { ReplacementRule } from '../types';
import { loadAllCharSettings, loadGlobalSettings, saveCharSettings, saveGlobalSettings } from './services/settingsService';
import { saveAsFile } from './services/fileService';
import { clearBlobUrlCache } from './utils/imageUtils';

interface Settings {
  format?: 'basic' | 'html' | 'markdown' | 'text';
  theme?: ThemeKey;
  color?: ColorKey;
  customCss?: string;
  showAvatar?: boolean;
  showBubble?: boolean;
  showHeader?: boolean;
  showHeaderIcon?: boolean;
  headerTags?: string;
  headerLayout?: 'default' | 'compact' | 'banner';
  headerBannerUrl?: string;
  headerBannerBlur?: boolean;
  headerBannerAlign?: number;
  showFooter?: boolean;
  footerLeft?: string;
  footerCenter?: string;
  footerRight?: string;
  imageScale?: number;
  embedImages?: boolean;
  expandHover?: boolean;
  imageResolution?: number | 'auto';
  imageLibrary?: 'html-to-image' | 'dom-to-image' | 'snapdom';
  imageFormat?: 'png' | 'jpeg' | 'webp';
  previewFontSize?: number;
  htmlScaleFactor?: number;
  htmlScaleMode?: 'font' | 'full';
  previewWidth?: number;
  rawHtmlView?: boolean;
  showArcaHelper?: boolean;
  customFilters?: { [key: string]: boolean };
  isEditable?: boolean;
  splitImage?: 'none' | 'chunk' | 'message';
  maxImageHeight?: number;
  replacementRules?: ReplacementRule[];
  disableAnimations?: boolean;
}


interface ShowCopyPreviewModalProps {
  options?: any;
  onClose: () => void;
}

const useWindowWidth = () => {
    const [width, setWidth] = useState(window.innerWidth || 1200);

    useEffect(() => {
      const handleResize = () => {
        setWidth(window.innerWidth);
      };
      window.addEventListener('resize', handleResize);
      handleResize();

      // iframe이 display: none에서 block으로 전환될 때 width를 정확히 잡기 위해 마운트 직후 수차례 재측정
      const timers = [
        setTimeout(handleResize, 50),
        setTimeout(handleResize, 150),
        setTimeout(handleResize, 300)
      ];

      return () => {
        window.removeEventListener('resize', handleResize);
        timers.forEach(clearTimeout);
      };
    }, []);

    return width;
  };

// SafeElement[]의 outerHTML을 받아 iframe 내 표준 HTMLElement[]로 재구성
function parseHtmlToElements(htmlStrings: string[]): HTMLElement[] {
  const parser = new DOMParser();
  const doc = parser.parseFromString('<div></div>', 'text/html');
  const container = doc.body.firstElementChild as HTMLElement;
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
  void container;
  return nodes;
}

const ShowCopyPreviewModal: React.FC<ShowCopyPreviewModalProps> = ({ options, onClose }) => {
    const [charName, setCharName] = useState('');
    const [chatName, setChatName] = useState('');
    const [charAvatarUrl, setCharAvatarUrl] = useState('');
    const [messageNodes, setMessageNodes] = useState<HTMLElement[]>([]);
    const [character, setCharacter] = useState<RisuCharacter | null>(null);
    const [participants, setParticipants] = useState<Set<string>>(new Set());
    const [uiClasses, setUiClasses] = useState<UIClassInfo[]>([]);
    const [preCollectedAvatarMap, setPreCollectedAvatarMap] = useState<Map<string, string>>(new Map());

    const defaultSettings: Settings = {
        format: 'basic',
        theme: 'basic',
        color: 'dark',
        customCss: '',
        showAvatar: true,
        showBubble: true,
        showHeader: true,
        showHeaderIcon: true,
        headerTags: '',
        headerLayout: 'default',
        headerBannerUrl: '',
        headerBannerBlur: true,
        headerBannerAlign: 50,
        showFooter: true,
        footerLeft: '',
        footerCenter: 'Created by Log Plugin',
        footerRight: '',
        imageScale: 100,
        embedImages: true,
        expandHover: false,
        imageResolution: 1,
        imageLibrary: 'html-to-image',
        imageFormat: 'png',
        previewFontSize: 16,
        htmlScaleFactor: 1.0,
        htmlScaleMode: 'font',
        previewWidth: 800,
        rawHtmlView: false,
        isEditable: false,
        splitImage: 'none',
        maxImageHeight: 10000,
        customFilters: {},
        replacementRules: [],
        disableAnimations: true,
      };

    const [savedSettings, setSavedSettings] = useState<Settings>(defaultSettings);
    const [globalSettings, setGlobalSettings] = useState<any>({});
    const [otherFormatContent, setOtherFormatContent] = useState('');
    const [activeTab, setActiveTab] = useState('export');
    const [isArcaHelperOpen, setIsArcaHelperOpen] = useState(false);
    const [isSettingsOpen, setIsSettingsOpen] = useState(false);
    const [isLoading, setIsLoading] = useState(true);
    const [progress, setProgress] = useState({ active: false, message: '', current: 0, total: 0 });
    const [selectedIndices, setSelectedIndices] = useState(new Set<number>());
    const [lastSelectedIndex, setLastSelectedIndex] = useState<number | null>(null);
    const [estimatedImageSize, setEstimatedImageSize] = useState<{width: number, height: number, maxMessageHeight: number} | null>(null);
    const [imageSizeWarning, setImageSizeWarning] = useState<string>('');
    const [error, setError] = useState<string | null>(null);

    const handleSelectionChange = (newSelection: Set<number>) => {
        setSelectedIndices(newSelection);
    };

    const handleLastSelectedIndexChange = (index: number | null) => {
        setLastSelectedIndex(index);
    };

    const handleSelectAll = () => {
        const allIndices = new Set(messageNodes.map((_, i) => i));
        setSelectedIndices(allIndices);
    };

    const handleDeselectAll = () => {
        setSelectedIndices(new Set());
        setLastSelectedIndex(null);
    };

    const handleInvertSelection = () => {
        const allIndices = new Set(messageNodes.map((_, i) => i));
        const newSelection = new Set(
            [...allIndices].filter(i => !selectedIndices.has(i))
        );
        setSelectedIndices(newSelection);
    };

    const handleDeleteSelected = () => {
        if (selectedIndices.size === 0) return;
        const newNodes = messageNodes.filter((_, i) => !selectedIndices.has(i));
        setMessageNodes(newNodes);
        setSelectedIndices(new Set());
        setLastSelectedIndex(null);
    };

    const handleProgressStart = (message: string, total = 0) => {
        setProgress({ active: true, message, current: 0, total });
    };
    const handleProgressUpdate = (update: { current?: number; message?: string }) => {
        setProgress(p => ({ ...p, ...update }));
    };
    const handleProgressEnd = () => {
        setProgress({ active: false, message: '', current: 0, total: 0 });
    };

    const width = useWindowWidth();
    const isMobile = width <= 768;
    const isTablet = width > 768 && width <= 1024;

    const themeInfo = THEMES[savedSettings.theme || 'basic'] || THEMES.basic;
    const colorPalette = savedSettings.theme === 'basic' ? (COLORS[savedSettings.color || 'dark'] || COLORS.dark) : (themeInfo.color || COLORS.dark);
    const backgroundColor = colorPalette.background;

    const handleSettingChange = (key: string, value: any) => {
        const newSettings = { ...savedSettings, [key]: value };
        setSavedSettings(newSettings);
    };

    // 전역 설정 변경: 상태 + pluginStorage에 저장
    const handleGlobalSettingChange = (key: string, value: any) => {
        const newSettings = { ...globalSettings, [key]: value };
        setGlobalSettings(newSettings);
        saveGlobalSettings(newSettings);
    };

    const handleMessageUpdate = useCallback((index: number, newHtml: string) => {
        setMessageNodes(currentNodes => {
            const newNodes = [...currentNodes];
            const nodeToUpdate = newNodes[index].cloneNode(true) as HTMLElement;
            const messageEl = nodeToUpdate.querySelector('.prose, .chattext');
            if (messageEl) {
                messageEl.innerHTML = newHtml;
                newNodes[index] = nodeToUpdate;
                return newNodes;
            }
            return currentNodes;
        });
    }, []);

    const handleSaveLogData = () => {
        const data = {
            charName,
            chatName,
            charAvatarUrl,
            messageNodes: messageNodes.map(node => node.outerHTML),
        };
        const content = JSON.stringify(data, null, 2);
        const safeCharName = charName.replace(/[\\/\?%\\*:|"<>]/g, '-');
        const safeChatName = chatName.replace(/[\\/\?%\\*:|"<>]/g, '-');
        const filename = `Risu_Log_Data_${safeCharName}_${safeChatName}.json`;
        saveAsFile(filename, content, 'application/json;charset=utf-8');
    };

    const handleLoadLogData = () => {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = '.json,application/json';
        input.onchange = async (e) => {
            const file = (e.target as HTMLInputElement).files?.[0];
            if (!file) return;

            const content = await file.text();
            try {
                const data = JSON.parse(content);
                if (data.charName && data.chatName && data.charAvatarUrl && Array.isArray(data.messageNodes)) {
                    setCharName(data.charName);
                    setChatName(data.chatName);
                    setCharAvatarUrl(data.charAvatarUrl);

                    const newNodes = data.messageNodes.map((html: string) => {
                        const tempDiv = document.createElement('div');
                        tempDiv.innerHTML = html;
                        return tempDiv.firstChild as HTMLElement;
                    });
                    setMessageNodes(newNodes);
                    alert('로그 데이터를 성공적으로 불러왔습니다.');
                } else {
                    alert('잘못된 형식의 로그 데이터 파일입니다.');
                }
            } catch (err) {
                alert('로그 데이터 파일을 읽는 데 실패했습니다.');
                console.error(err);
            }
        };
        input.click();
    };

    // 캐릭터별 설정 저장 (pluginStorage)
    useEffect(() => {
        if (character?.chaId && Object.keys(savedSettings).length > 0) {
            saveCharSettings(String(character.chaId), savedSettings);
        }
    }, [savedSettings, character]);

    useEffect(() => {
        const fetchData = async () => {
            setIsLoading(true);
            setError(null);
            try {
                // v3.0: processChatLog이 SafeElement[] 반환 → outerHTML로 직렬화 후 iframe 내 HTMLElement로 재구성
                const { charName, chatName, charAvatarUrl, messageNodes: safeNodes, character, avatarMap } = await processChatLog(undefined, options);
                const htmlStrings = await serializeNodes(safeNodes);
                const nodes = parseHtmlToElements(htmlStrings);

                setCharName(charName);
                setChatName(chatName);
                setCharAvatarUrl(charAvatarUrl);
                setMessageNodes(nodes);
                setCharacter(character);

                const mapObj = new Map<string, string>();
                if (avatarMap) {
                    Object.entries(avatarMap).forEach(([k, v]) => {
                        mapObj.set(k, String(v));
                    });
                }
                setPreCollectedAvatarMap(mapObj);

                const allCharSettings = await loadAllCharSettings();
                const charSettings = character ? allCharSettings[String(character.chaId)] || {} : {};
                setSavedSettings({ ...defaultSettings, ...charSettings });

                const loadedGlobalSettings = await loadGlobalSettings();
                setGlobalSettings(loadedGlobalSettings);

                const newParticipants = new Set<string>();
                nodes.forEach((node: HTMLElement) => {
                    const name = getNameFromNode(node, loadedGlobalSettings, charName);
                    if (name) newParticipants.add(name);
                });
                setParticipants(newParticipants);

                setUiClasses(collectUIClasses(nodes));

            } catch (err: any) {
                console.error('[Log Exporter] Modal open error:', err);
                setError(err?.stack || String(err));
            } finally {
                setIsLoading(false);
            }
        };

        fetchData();
    }, [options]);

    const activeFilters = savedSettings.customFilters ? Object.entries(savedSettings.customFilters).filter(([, checked]) => checked).map(([key]) => key) : [];

    const finalNodes = messageNodes
        .map(node => {
            if (activeFilters.length > 0) {
                return filterWithCustomClasses(node, activeFilters, globalSettings);
            }
            return node;
        })
        .filter(node => {
            const isMessageNode = node.querySelector('.prose, .chattext');
            if (isMessageNode) {
                const name = getNameFromNode(node as HTMLElement, globalSettings, charName);
                if (globalSettings?.filteredParticipants?.includes(name)) {
                    return false;
                }
            }
            return true;
        });

    const nodesForExport = selectedIndices.size > 0
        ? finalNodes.filter((_, i) => selectedIndices.has(i))
        : finalNodes;

    const logContainerProps = useMemo(() => ({
        nodes: finalNodes,
        charInfo: { name: charName, chatName: chatName, avatarUrl: charAvatarUrl },
        selectedThemeKey: savedSettings.theme || 'basic',
        selectedColorKey: savedSettings.color || 'dark',
        color: colorPalette,
        customCss: savedSettings.customCss,
        showAvatar: savedSettings.showAvatar,
        showHeader: savedSettings.showHeader,
        showHeaderIcon: savedSettings.showHeaderIcon,
        headerTags: savedSettings.headerTags,
        headerLayout: savedSettings.headerLayout,
        headerBannerUrl: savedSettings.headerBannerUrl,
        headerBannerBlur: savedSettings.headerBannerBlur,
        headerBannerAlign: savedSettings.headerBannerAlign,
        showFooter: savedSettings.showFooter,
        footerLeft: savedSettings.footerLeft,
        footerCenter: savedSettings.footerCenter,
        footerRight: savedSettings.footerRight,
        showBubble: savedSettings.showBubble,
        embedImagesAsBlob: true,
        globalSettings: globalSettings,
        fontSize: savedSettings.htmlScaleFactor !== undefined ? 16 * savedSettings.htmlScaleFactor : savedSettings.previewFontSize,
        containerWidth: savedSettings.previewWidth,
        imageScale: savedSettings.imageScale,
        isEditable: savedSettings.isEditable,
        onMessageUpdate: handleMessageUpdate,
        replacementRules: savedSettings.replacementRules,
        disableAnimations: savedSettings.disableAnimations,
        preCollectedAvatarMap: preCollectedAvatarMap,
    }), [
        finalNodes,
        charName, chatName, charAvatarUrl,
        savedSettings,
        globalSettings,
        colorPalette,
        handleMessageUpdate
    ]);

    const handleDimensionsChange = useCallback((dims: { width: number, height: number, maxMessageHeight: number }) => {
        setEstimatedImageSize(dims);
    }, []);

    useEffect(() => {
        if (!estimatedImageSize) {
            setImageSizeWarning('');
            return;
        }

        const MAX_DIMENSION = 16384;
        const resolution = savedSettings.imageResolution === 'auto' ? 1 : (Number(savedSettings.imageResolution) || 1);

        const finalWidth = estimatedImageSize.width * resolution;
        const finalHeight = estimatedImageSize.height * resolution;

        let warnings = [];
        if (finalWidth > MAX_DIMENSION || finalHeight > MAX_DIMENSION) {
            let warning = `예상 이미지 크기(${Math.round(finalWidth)}x${Math.round(finalHeight)}px)가 브라우저 한계를 초과할 수 있습니다.`;
            if (savedSettings.splitImage === 'none') {
                warning += " '긴 이미지 분할' 옵션 사용을 권장합니다.";
            }
            if (savedSettings.imageResolution === 'auto') {
                warning += " '자동' 해상도는 현재 1x로 계산됩니다.";
            }
            warnings.push(warning);
        }

        if (savedSettings.splitImage !== 'none' && estimatedImageSize.maxMessageHeight > (savedSettings.maxImageHeight || 10000)) {
            if (savedSettings.splitImage === 'chunk') {
                warnings.push(`분할 최대 높이(${savedSettings.maxImageHeight || 10000}px)보다 긴 로그가 있습니다. 여러 섹션으로 분할 캡처 후 하나의 이미지 파일로 병합됩니다.`);
            } else {
                warnings.push(`분할 최대 높이(${savedSettings.maxImageHeight || 10000}px)보다 긴 메시지가 있습니다. 해당 메시지는 여러 섹션으로 분할하여 개별 파일로 저장됩니다.`);
            }
        }

        setImageSizeWarning(warnings.join(' '));
    }, [estimatedImageSize, savedSettings.imageResolution, savedSettings.splitImage, savedSettings.maxImageHeight]);

    const getPreviewContentForExport = async () => {
        if (savedSettings.format === 'basic' || !savedSettings.format) {
            return await getLogHtml({...logContainerProps, nodes: nodesForExport, isEditable: false, embedImagesAsBlob: true });
        } else if (savedSettings.format === 'html') {
            const htmlLog = await generateHtmlPreview(nodesForExport, savedSettings, preCollectedAvatarMap);
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
                margin: 0 auto;
              }
            </style>`);
        } else if (savedSettings.format === 'markdown') {
            return await generateMarkdownLog(nodesForExport, charName, savedSettings);
        } else if (savedSettings.format === 'text') {
            return await generateTextLog(nodesForExport, charName, savedSettings);
        }
        return '';
    };

    useEffect(() => {
        const generateOtherFormatPreview = async () => {
            if (savedSettings.format === 'basic' || !savedSettings.format) {
                setOtherFormatContent('');
                return;
            }
            const content = await getPreviewContentForExport();
            if (savedSettings.format === 'markdown' || savedSettings.format === 'text') {
                const style = `font-size: ${savedSettings.previewFontSize || 16}px; max-width: ${savedSettings.previewWidth || 800}px; margin: 20px auto; padding: 20px; background-color: #1a1b26; color: #c0caf5; border-radius: 8px;`;
                setOtherFormatContent(`<div style="${style}"><pre style="white-space: pre-wrap; word-wrap: break-word;">${content}</pre></div>`);
            } else {
                setOtherFormatContent(content);
            }
        };

        generateOtherFormatPreview();
    }, [finalNodes, selectedIndices, savedSettings, globalSettings, charName]);

    const handleClose = async () => {
        clearBlobUrlCache();
        // iframe을 먼저 숨겨 사용자 클릭이 iframe에 닿지 않도록 한 뒤
        // React를 정리합니다. 순서가 중요: hideContainer → unmount → remove.
        await Risuai.hideContainer();
        onClose();
    };

    // ESC 단축키로 닫기 (중복 호출 방지)
    const closedRef = { current: false };
    useEffect(() => {
        const onKey = (e: KeyboardEvent) => {
            if (e.key === 'Escape' && !closedRef.current) {
                closedRef.current = true;
                handleClose();
            }
        };
        document.addEventListener('keydown', onKey);
        return () => document.removeEventListener('keydown', onKey);
    }, []);

    const uiTheme = globalSettings.uiTheme || 'dark';
    useEffect(() => {
        document.body.setAttribute('data-theme', uiTheme);
        const rootEl = document.getElementById('log-exporter-react-modal-root');
        if (rootEl) {
            rootEl.setAttribute('data-theme', uiTheme);
        }
    }, [uiTheme]);

    const antTheme = {
        algorithm: uiTheme === 'light' ? theme.defaultAlgorithm : theme.darkAlgorithm,
        token: {
            colorPrimary: '#61afef',
            motion: false,
        }
    };

    const handleBackdropClick = (e: React.MouseEvent) => {
        if (e.target === e.currentTarget) {
            handleClose();
        }
    };

    if (error) {
        return (
            <ConfigProvider theme={antTheme}>
                <div className="log-exporter-modal-backdrop" onClick={handleBackdropClick}>
                    <div className="log-exporter-modal" data-theme={uiTheme} onClick={(e) => e.stopPropagation()} style={{ padding: '24px', maxWidth: '600px', margin: '40px auto', overflowY: 'auto' }}>
                        <h3 style={{ color: '#ff4d4f', margin: '0 0 12px 0' }}>[Log Exporter] 오류 발생</h3>
                        <pre style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-all', backgroundColor: 'var(--bg-secondary)', color: 'var(--text-color)', padding: '12px', border: '1px solid var(--border-color)', borderRadius: '4px', maxHeight: '400px', overflowY: 'auto' }}>{error}</pre>
                        <Button type="primary" danger onClick={handleClose}>닫기</Button>
                    </div>
                </div>
            </ConfigProvider>
        );
    }

    return (
        <ConfigProvider theme={antTheme}>
            <div className="log-exporter-modal-backdrop" onClick={handleBackdropClick}>
                {!isArcaHelperOpen && (
                    <div className="log-exporter-modal" data-theme={uiTheme} onClick={(e) => e.stopPropagation()}>
                        <div className="log-exporter-modal-header-bar" style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '12px 16px' }}>
                            <Button 
                                id="log-exporter-close" 
                                className="log-exporter-modal-close-btn" 
                                type="text"
                                icon={<CloseOutlined />}
                                title="닫기 (Esc)" 
                                aria-label="모달 닫기" 
                                onClick={handleClose}
                                style={{ color: 'var(--text-white)' }}
                            />
                            <span className="header-title" style={{ flex: 1, fontSize: '1.2em', fontWeight: 'bold' }}>로그 플러그인</span>
                            <Button 
                                type="text"
                                icon={<EditOutlined />}
                                onClick={() => handleSettingChange('isEditable', !savedSettings.isEditable)}
                                style={{ color: savedSettings.isEditable ? 'var(--accent-primary)' : 'var(--text-white)' }}
                                title="로그 편집 활성화 토글"
                            >
                                {(isMobile || isTablet) ? null : '로그 편집'}
                            </Button>
                            <Button 
                                type="text"
                                icon={<SettingOutlined />}
                                onClick={() => setIsSettingsOpen(true)}
                                style={{ color: 'var(--text-white)' }}
                            >
                                설정
                            </Button>
                        </div>
                        {isLoading ? (
                            <div className="desktop-modal-loading" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '300px', gap: '12px' }}>
                                <Spin size="large" />
                                <p>로그 데이터를 불러오는 중...</p>
                            </div>
                        ) : (isMobile || isTablet) ? (
                            <div className="log-exporter-modal-content">
                                <div className="mobile-tab-navigation">
                                    <button className={`mobile-tab-btn ${activeTab === 'settings' ? 'active' : ''}`} onClick={() => setActiveTab('settings')}>
                                        설정
                                    </button>
                                    <button className={`mobile-tab-btn ${activeTab === 'preview' ? 'active' : ''}`} onClick={() => setActiveTab('preview')}>
                                        미리보기
                                    </button>
                                    <button className={`mobile-tab-btn ${activeTab === 'tools' ? 'active' : ''}`} onClick={() => setActiveTab('tools')}>
                                        도구
                                    </button>
                                </div>
                                <div className={`mobile-tab-content mobile-settings-tab ${activeTab === 'settings' ? 'active' : ''}`}>
                                    <MobileSettingsPanel
                                        settings={savedSettings}
                                        onSettingChange={handleSettingChange}
                                        themes={THEMES}
                                        colors={COLORS}
                                        participants={participants}
                                        globalSettings={globalSettings}
                                        onGlobalSettingChange={handleGlobalSettingChange}
                                        uiClasses={uiClasses}
                                    />
                                </div>
                                <div className={`mobile-tab-content mobile-preview-tab ${activeTab === 'preview' ? 'active' : ''}`}>
                                    <PreviewPanel
                                        logContainerProps={logContainerProps}
                                        settings={savedSettings}
                                        otherFormatContent={otherFormatContent}
                                        selectedIndices={selectedIndices}
                                        onSelectionChange={handleSelectionChange}
                                        lastSelectedIndex={lastSelectedIndex}
                                        onLastSelectedIndexChange={handleLastSelectedIndexChange}
                                        onSelectAll={handleSelectAll}
                                        onDeselectAll={handleDeselectAll}
                                        onInvertSelection={handleInvertSelection}
                                        onDimensionsChange={handleDimensionsChange}
                                    />
                                </div>
                                <div className={`mobile-tab-content mobile-tools-tab ${activeTab === 'tools' ? 'active' : ''}`}>
                                    <MobileToolsPanel
                                        settings={savedSettings}
                                        onSettingChange={handleSettingChange}
                                        imageSizeWarning={imageSizeWarning}
                                    />
                                </div>
                                <div className="mobile-action-bar">
                                    <Actionbar
                                        charName={charName}
                                        chatName={chatName}
                                        getPreviewContent={getPreviewContentForExport}
                                        messageNodes={nodesForExport}
                                        settings={savedSettings}
                                        backgroundColor={backgroundColor}
                                        color={colorPalette}
                                        charAvatarUrl={charAvatarUrl}
                                        onOpenArcaHelper={() => setIsArcaHelperOpen(true)}
                                        onProgressStart={handleProgressStart}
                                        onProgressUpdate={handleProgressUpdate}
                                        onProgressEnd={handleProgressEnd}
                                        onSaveLogData={handleSaveLogData}
                                        onLoadLogData={handleLoadLogData}
                                        onDeleteSelected={handleDeleteSelected}
                                        hasSelection={selectedIndices.size > 0}
                                        onSelectAll={handleSelectAll}
                                        onDeselectAll={handleDeselectAll}
                                        onInvertSelection={handleInvertSelection}
                                    />
                                </div>
                            </div>
                        ) : (
                            <>
                                <div className="log-exporter-modal-content" style={{ display: 'grid', gridTemplateColumns: '450px 1fr', height: 'calc(100% - 71px)', overflow: 'hidden' }}>
                                    <div className="desktop-settings-panel" style={{ display: 'flex', flexDirection: 'column', height: '100%', borderRight: '1px solid var(--border-color)', background: 'var(--bg-secondary)', overflow: 'hidden' }}>
                                        <Tabs
                                            activeKey={activeTab}
                                            onChange={setActiveTab}
                                            style={{ height: '100%', display: 'flex', flexDirection: 'column' }}
                                            tabBarStyle={{ padding: '0 16px', margin: 0 }}
                                            items={[
                                                {
                                                    key: 'export',
                                                    label: (
                                                        <span>
                                                            <ExportOutlined />
                                                            내보내기
                                                        </span>
                                                    ),
                                                    children: (
                                                        <ExportTab
                                                            settings={savedSettings}
                                                            onSettingChange={handleSettingChange}
                                                            themes={THEMES}
                                                            colors={COLORS}
                                                        />
                                                    ),
                                                },
                                                {
                                                    key: 'filter',
                                                    label: (
                                                        <span>
                                                            <FilterOutlined />
                                                            필터
                                                        </span>
                                                    ),
                                                    children: (
                                                        <FilterTab
                                                            settings={savedSettings}
                                                            onSettingChange={handleSettingChange}
                                                            participants={participants}
                                                            globalSettings={globalSettings}
                                                            onGlobalSettingChange={handleGlobalSettingChange}
                                                            uiClasses={uiClasses}
                                                        />
                                                    ),
                                                },
                                                {
                                                    key: 'replacement',
                                                    label: (
                                                        <span>
                                                            <TranslationOutlined />
                                                            단어 바꾸기
                                                        </span>
                                                    ),
                                                    children: (
                                                        <ReplacementTab
                                                            rules={savedSettings.replacementRules || []}
                                                            onRulesChange={(rules) => handleSettingChange('replacementRules', rules)}
                                                        />
                                                    ),
                                                },
                                                {
                                                    key: 'advanced',
                                                    label: (
                                                        <span>
                                                            <SlidersOutlined />
                                                            고급
                                                        </span>
                                                    ),
                                                    children: (
                                                        <AdvancedTab
                                                            settings={savedSettings}
                                                            onSettingChange={handleSettingChange}
                                                            imageSizeWarning={imageSizeWarning}
                                                        />
                                                    ),
                                                },
                                            ]}
                                        />
                                    </div>
                                    <div className="desktop-preview-panel" style={{ overflow: 'hidden', display: 'flex', flexDirection: 'column', height: '100%', position: 'relative' }}>
                                         <PreviewPanel
                                             logContainerProps={logContainerProps}
                                             settings={savedSettings}
                                             otherFormatContent={otherFormatContent}
                                             selectedIndices={selectedIndices}
                                             onSelectionChange={handleSelectionChange}
                                             lastSelectedIndex={lastSelectedIndex}
                                             onLastSelectedIndexChange={handleLastSelectedIndexChange}
                                             onSelectAll={handleSelectAll}
                                             onDeselectAll={handleDeselectAll}
                                             onInvertSelection={handleInvertSelection}
                                             onDimensionsChange={handleDimensionsChange}
                                         />
                                         <div className="desktop-floating-action-bar">
                                             <Actionbar
                                                 charName={charName}
                                                 chatName={chatName}
                                                 getPreviewContent={getPreviewContentForExport}
                                                 messageNodes={nodesForExport}
                                                 settings={savedSettings}
                                                 backgroundColor={backgroundColor}
                                                 color={colorPalette}
                                                 charAvatarUrl={charAvatarUrl}
                                                 onOpenArcaHelper={() => setIsArcaHelperOpen(true)}
                                                 onProgressStart={handleProgressStart}
                                                 onProgressUpdate={handleProgressUpdate}
                                                 onProgressEnd={handleProgressEnd}
                                                 onSaveLogData={handleSaveLogData}
                                                 onLoadLogData={handleLoadLogData}
                                                 onDeleteSelected={handleDeleteSelected}
                                                 hasSelection={selectedIndices.size > 0}
                                                 onSelectAll={handleSelectAll}
                                                 onDeselectAll={handleDeselectAll}
                                                 onInvertSelection={handleInvertSelection}
                                             />
                                         </div>
                                     </div>
                                 </div>
                            </>
                        )}

                    </div>
                )}
                {progress.active && (
                    <div className="desktop-modal-loading progress-overlay" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '12px' }}>
                        <Spin size="large" />
                        <p>{progress.message}</p>
                        {progress.total > 0 && (
                            <span>{progress.current} / {progress.total}</span>
                        )}
                    </div>
                )}
            </div>



            {isArcaHelperOpen && (
                <ArcaHelperModal
                    isOpen={isArcaHelperOpen}
                    onClose={() => setIsArcaHelperOpen(false)}
                    messageNodes={messageNodes}
                    charInfo={{ name: charName, chatName: chatName, avatarUrl: charAvatarUrl }}
                    settings={savedSettings}
                    globalSettings={globalSettings}
                    uiTheme={uiTheme}
                    colorPalette={colorPalette}
                />
            )}
            {isSettingsOpen && (
                <PluginSettingsModal
                    isOpen={isSettingsOpen}
                    onClose={() => setIsSettingsOpen(false)}
                    globalSettings={globalSettings}
                    onGlobalSettingChange={handleGlobalSettingChange}
                />
            )}
        </ConfigProvider>
    );
};

let root: ReactDOM.Root | null = null;
let container: HTMLDivElement | null = null;
let isModalOpen = false;

/**
 * 로그 내보내기 모달을 iframe 내부에서 풀스크린으로 엽니다.
 * v3.0: iframe DOM에 React 렌더 → Risuai.showContainer('fullscreen')
 */
export const showCopyPreviewModal = async (options: {
  startIndex?: number;
  endIndex?: number;
  singleMessage?: boolean;
} = {}): Promise<void> => {
  // 이미 열려있으면 먼저 닫기
  if (root) {
    root.unmount();
    root = null;
  }
  if (container) {
    container.remove();
    container = null;
  }
  isModalOpen = false;

  // iframe 내부 document에 컨테이너 생성
  container = document.createElement('div');
  container.id = 'log-exporter-react-modal-root';
  document.body.appendChild(container);

  root = ReactDOM.createRoot(container);
  isModalOpen = true;

  const handleClose = async () => {
    if (!isModalOpen) return;
    isModalOpen = false;
    // iframe을 먼저 숨겨 클릭이 iframe에 닿지 않도록 한 뒤 React 정리
    await Risuai.hideContainer();
    if (root) {
      root.unmount();
      root = null;
    }
    if (container) {
      container.remove();
      container = null;
    }
  };

  root.render(
    <React.StrictMode>
      <ShowCopyPreviewModal options={options} onClose={handleClose} />
    </React.StrictMode>
  );

  // iframe 전체화면 표시 (v3.0)
  await Risuai.showContainer('fullscreen');
  window.focus();
  if (container) {
    container.focus();
  }
};

export default ShowCopyPreviewModal;