/* eslint-disable @typescript-eslint/no-explicit-any */
import React, { useRef, useEffect, useLayoutEffect, useState } from 'react';
import { Button, Spin, Popover, Segmented, Select, Input, Slider } from '../../components/ui';
import { 
  FileText, 
  Code, 
  FileCode, 
  AlignLeft, 
  Palette, 
  Eye, 
  Shirt, 
  Layout, 
  Image as ImageIcon, 
  ZoomIn, 
  ZoomOut, 
  Minimize2 
} from 'lucide-react';
import LogContainer from './LogContainer';
import type { LogContainerProps, ThemeInfo, ColorPalette } from '../../types';
import { getLogHtml } from '../services/htmlGenerator';
import SettingToggle from './SettingToggle';

interface PreviewPanelProps {
  settings: any;
  logContainerProps: Omit<LogContainerProps, 'onReady'>;
  otherFormatContent: string;
  selectedIndices: Set<number>;
  onSelectionChange: (newSelection: Set<number>) => void;
  onLastSelectedIndexChange: (index: number | null) => void;
  lastSelectedIndex: number | null;
  onSelectAll?: () => void;
  onDeselectAll?: () => void;
  onInvertSelection?: () => void;
  onDimensionsChange: (dims: { width: number, height: number, maxMessageHeight: number }) => void;
  isConverting: boolean;
  onSettingChange: (key: string, value: any) => void;
  themes: Record<string, ThemeInfo>;
  colors: Record<string, ColorPalette>;
}

const MIN_PREVIEW_SCALE = 0.15;
const MAX_PREVIEW_SCALE = 2;

interface ScaledPreviewProps {
  width: number;
  children: React.ReactNode;
}

interface PinchState {
  distance: number;
  scale: number;
  contentX: number;
  contentY: number;
}

/**
 * Renders the export document at its real output width and scales only the
 * viewport. This keeps line wrapping and image layout identical to the saved
 * image while still allowing a small screen to inspect and pan the document.
 */
const ScaledPreview: React.FC<ScaledPreviewProps> = ({ width, children }) => {
  const viewportRef = useRef<HTMLDivElement>(null);
  const documentRef = useRef<HTMLDivElement>(null);
  const pinchRef = useRef<PinchState | null>(null);
  const [documentHeight, setDocumentHeight] = useState(0);
  const [scale, setScale] = useState(1);
  const [fitMode, setFitMode] = useState(true);

  const fitToViewport = React.useCallback(() => {
    const viewport = viewportRef.current;
    if (!viewport) return;
    const availableWidth = Math.max(1, viewport.clientWidth - 24);
    setScale(Math.min(1, Math.max(MIN_PREVIEW_SCALE, availableWidth / width)));
  }, [width]);

  useLayoutEffect(() => {
    const documentElement = documentRef.current;
    const viewport = viewportRef.current;
    if (!documentElement || !viewport) return;

    const updateDocumentHeight = () => {
      setDocumentHeight(documentElement.offsetHeight);
    };
    const updateViewport = () => {
      if (fitMode) fitToViewport();
    };

    updateDocumentHeight();
    updateViewport();

    const documentObserver = new ResizeObserver(updateDocumentHeight);
    const viewportObserver = new ResizeObserver(updateViewport);
    documentObserver.observe(documentElement);
    viewportObserver.observe(viewport);

    return () => {
      documentObserver.disconnect();
      viewportObserver.disconnect();
    };
  }, [fitMode, fitToViewport]);

  const changeScale = (nextScale: number) => {
    const viewport = viewportRef.current;
    const clampedScale = Math.min(MAX_PREVIEW_SCALE, Math.max(MIN_PREVIEW_SCALE, nextScale));

    setFitMode(false);
    if (viewport) {
      const contentX = (viewport.scrollLeft + viewport.clientWidth / 2) / scale;
      const contentY = (viewport.scrollTop + viewport.clientHeight / 2) / scale;
      setScale(clampedScale);
      requestAnimationFrame(() => {
        viewport.scrollTo({
          left: contentX * clampedScale - viewport.clientWidth / 2,
          top: contentY * clampedScale - viewport.clientHeight / 2,
        });
      });
      return;
    }
    setScale(clampedScale);
  };

  const handleFit = () => {
    setFitMode(true);
    fitToViewport();
    viewportRef.current?.scrollTo({ left: 0, behavior: 'smooth' });
  };

  const handleTouchStart = (event: React.TouchEvent<HTMLDivElement>) => {
    if (event.touches.length !== 2 || !viewportRef.current) return;
    const [first, second] = Array.from(event.touches);
    const viewport = viewportRef.current;
    const rect = viewport.getBoundingClientRect();
    const midpointX = (first.clientX + second.clientX) / 2 - rect.left;
    const midpointY = (first.clientY + second.clientY) / 2 - rect.top;

    pinchRef.current = {
      distance: Math.hypot(second.clientX - first.clientX, second.clientY - first.clientY),
      scale,
      contentX: (viewport.scrollLeft + midpointX) / scale,
      contentY: (viewport.scrollTop + midpointY) / scale,
    };
    setFitMode(false);
  };

  const handleTouchMove = (event: React.TouchEvent<HTMLDivElement>) => {
    const pinch = pinchRef.current;
    const viewport = viewportRef.current;
    if (!pinch || !viewport || event.touches.length !== 2) return;
    event.preventDefault();

    const [first, second] = Array.from(event.touches);
    const rect = viewport.getBoundingClientRect();
    const midpointX = (first.clientX + second.clientX) / 2 - rect.left;
    const midpointY = (first.clientY + second.clientY) / 2 - rect.top;
    const distance = Math.hypot(second.clientX - first.clientX, second.clientY - first.clientY);
    const nextScale = Math.min(
      MAX_PREVIEW_SCALE,
      Math.max(MIN_PREVIEW_SCALE, pinch.scale * (distance / pinch.distance)),
    );

    setScale(nextScale);
    requestAnimationFrame(() => {
      viewport.scrollTo({
        left: pinch.contentX * nextScale - midpointX,
        top: pinch.contentY * nextScale - midpointY,
      });
    });
  };

  const handleTouchEnd = (event: React.TouchEvent<HTMLDivElement>) => {
    if (event.touches.length < 2) pinchRef.current = null;
  };

  return (
    <div
      className="preview-viewport"
      ref={viewportRef}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      onTouchCancel={handleTouchEnd}
    >
      <div className="preview-zoom-controls" role="group" aria-label="미리보기 확대/축소">
        <Button
          size="small"
          type="text"
          icon={<ZoomOut size={13} />}
          aria-label="축소"
          title="축소"
          onClick={() => changeScale(scale - 0.1)}
          disabled={scale <= MIN_PREVIEW_SCALE}
        />
        <button
          type="button"
          className="preview-zoom-value"
          title="화면에 맞추기"
          onClick={handleFit}
        >
          {Math.round(scale * 100)}%
        </button>
        <Button
          size="small"
          type="text"
          icon={<ZoomIn size={13} />}
          aria-label="확대"
          title="확대"
          onClick={() => changeScale(scale + 0.1)}
          disabled={scale >= MAX_PREVIEW_SCALE}
        />
        <Button
          size="small"
          type="text"
          icon={<Minimize2 size={13} />}
          aria-label="화면에 맞추기"
          title="화면에 맞추기"
          onClick={handleFit}
        />
      </div>
      <div
        className="preview-scaled-stage"
        style={{
          width: `${width * scale}px`,
          height: `${documentHeight * scale}px`,
        }}
      >
        <div
          ref={documentRef}
          className="preview-export-document"
          data-log-export-document
          style={{
            width: `${width}px`,
            transform: `translateX(-50%) scale(${scale})`,
          }}
        >
          {children}
        </div>
      </div>
    </div>
  );
};

const PreviewPanel: React.FC<PreviewPanelProps> = ({ 
  settings, 
  logContainerProps, 
  otherFormatContent,
  selectedIndices,
  onSelectionChange,
  onLastSelectedIndexChange,
  lastSelectedIndex,
  onSelectAll,
  onDeselectAll,
  onInvertSelection,
  onDimensionsChange,
  isConverting,
  onSettingChange,
  themes,
  colors,
}) => {
  const shadowHostRef = useRef<HTMLDivElement>(null);
  const previewContentRef = useRef<HTMLDivElement>(null);
  const [rawHtmlContent, setRawHtmlContent] = useState('');

  const isBasicFormat = settings.format === 'basic' || !settings.format;

  const onReady = React.useCallback(() => {
    if (previewContentRef.current) {
      const element = previewContentRef.current.querySelector<HTMLElement>('[data-log-export-document] > div')
        || previewContentRef.current;
      let maxMessageHeight = 0;
      const messageElements = element.querySelectorAll('.chat-message-container');
      messageElements.forEach(msg => {
          if ((msg as HTMLElement).offsetHeight > maxMessageHeight) {
              maxMessageHeight = (msg as HTMLElement).offsetHeight;
          }
      });

      onDimensionsChange({
        width: element.offsetWidth,
        height: element.offsetHeight,
        maxMessageHeight: maxMessageHeight,
      });
    }
  }, [onDimensionsChange]);

  const handleMessageSelect = (index: number, e: React.MouseEvent) => {
    const newSelection = new Set(selectedIndices);
    if (e.shiftKey && lastSelectedIndex !== null) {
      const start = Math.min(lastSelectedIndex, index);
      const end = Math.max(lastSelectedIndex, index);
      for (let i = start; i <= end; i++) {
        newSelection.add(i);
      }
    } else {
      if (newSelection.has(index)) {
        newSelection.delete(index);
      } else {
        newSelection.add(index);
      }
    }
    onSelectionChange(newSelection);
    onLastSelectedIndexChange(index);
  };

  useEffect(() => {
    if (settings.rawHtmlView) {
      if (isBasicFormat) {
        getLogHtml(logContainerProps).then(setRawHtmlContent);
      } else {
        setRawHtmlContent(otherFormatContent);
      }
    }
  }, [settings.rawHtmlView, logContainerProps, otherFormatContent, isBasicFormat]);

  useEffect(() => {
    if (shadowHostRef.current && !isBasicFormat && !settings.rawHtmlView) {
        if (!shadowHostRef.current.shadowRoot) {
            shadowHostRef.current.attachShadow({ mode: 'open' });
        }
        const shadowRoot = shadowHostRef.current.shadowRoot!;
        shadowRoot.innerHTML = `
            <style>
                :host {
                    all: initial;
                    display: block;
                }
                img, video {
                    max-width: 100%;
                    height: auto;
                    display: block;
                }
            </style>
            ${otherFormatContent}
        `;
    }
  }, [otherFormatContent, isBasicFormat, settings.rawHtmlView]);

  const renderContent = () => {
    if (settings.rawHtmlView) {
      return (
        <textarea
          readOnly
          style={{
            width: '100%',
            height: '100%',
            whiteSpace: 'pre-wrap',
            wordWrap: 'break-word',
            backgroundColor: 'var(--card)',
            color: 'var(--foreground)',
            border: '1px solid var(--border)',
            borderRadius: 'var(--radius)',
            padding: '16px',
            fontFamily: 'monospace',
            fontSize: '12px',
            boxSizing: 'border-box',
            outline: 'none',
            resize: 'none',
          }}
          value={rawHtmlContent}
        />
      );
    }
    if (isBasicFormat) {
      return (
        <ScaledPreview width={Number(logContainerProps.containerWidth) || 900}>
          <LogContainer
            {...logContainerProps}
            onReady={onReady}
            selectedIndices={selectedIndices}
            onMessageSelect={handleMessageSelect}
          />
        </ScaledPreview>
      );
    }
    return <div ref={shadowHostRef}></div>;
  };

  const showSpinner = !isBasicFormat && isConverting;

  // 1. 커스텀 CSS 편집 Popover 내용
  const customCssPopoverContent = (
    <div style={{ width: '280px' }} className="export-style-settings-content">
      <div className="setting-field">
        <span className="setting-field-label" style={{ fontWeight: 500, fontSize: '0.9em', color: 'var(--text-primary)' }}>커스텀 CSS</span>
        <Input.TextArea
          value={settings.customCss || ''}
          onChange={(e) => onSettingChange('customCss', e.target.value)}
          placeholder="여기에 CSS 코드를 입력하세요..."
          autoSize={{ minRows: 4, maxRows: 10 }}
        />
      </div>
    </div>
  );

  const displayOptionsContent = (
    <div style={{ width: '290px', maxHeight: '70vh', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '16px', padding: '2px 4px 16px 2px', boxSizing: 'border-box' }} className="export-option-settings-content">
      {isBasicFormat && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <SettingToggle
            label="아바타"
            description="프로필 이미지 표시"
            checked={settings.showAvatar}
            onChange={(v) => onSettingChange('showAvatar', v)}
          />
          {settings.showAvatar !== false && (
            <div style={{ paddingLeft: '12px', display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '2px' }}>
              <div className="setting-field">
                <span className="setting-field-label" style={{ fontSize: '0.85em', color: 'var(--text-secondary)' }}>아바타 위치</span>
                <Select
                  size="small"
                  value={settings.avatarPosition || 'opposite'}
                  onChange={(val) => onSettingChange('avatarPosition', val)}
                  style={{ width: '100%' }}
                  options={[
                    { value: 'opposite', label: '말풍선 옆 - 기본' },
                    { value: 'left', label: '말풍선 옆 - 항상 좌측' },
                    { value: 'right', label: '말풍선 옆 - 항상 우측' },
                    { value: 'opposite-top', label: '이름 옆 - 기본' },
                    { value: 'top-left', label: '이름 옆 - 항상 좌측' },
                    { value: 'top-right', label: '이름 옆 - 항상 우측' },
                  ]}
                />
              </div>
              <div className="setting-field">
                <span className="setting-field-label" style={{ fontSize: '0.85em', color: 'var(--text-secondary)' }}>아바타 모양</span>
                <Select
                  size="small"
                  value={settings.avatarShape || 'theme'}
                  onChange={(val) => onSettingChange('avatarShape', val)}
                  style={{ width: '100%' }}
                  options={[
                    { value: 'theme', label: '테마 기본값' },
                    { value: 'circle', label: '동그라미' },
                    { value: 'square', label: '네모' },
                    { value: 'rounded', label: '둥근 네모' },
                    { value: 'squircle', label: '애매한 네모' },
                  ]}
                />
              </div>
            </div>
          )}

          <SettingToggle
            label="말풍선"
            description="메시지 말풍선 스타일"
            checked={settings.showBubble}
            onChange={(v) => onSettingChange('showBubble', v)}
          />

          <SettingToggle
            label="헤더"
            description="상단 정보 표시"
            checked={settings.showHeader}
            onChange={(v) => onSettingChange('showHeader', v)}
          />
          {settings.showHeader !== false && (
            <div style={{ paddingLeft: '12px', display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '2px' }}>
              <SettingToggle
                label="헤더 아이콘"
                description="헤더 프로필 이미지 표시"
                checked={settings.showHeaderIcon}
                onChange={(v) => onSettingChange('showHeaderIcon', v)}
              />
              <div className="setting-field">
                <span className="setting-field-label" style={{ fontSize: '0.85em', color: 'var(--text-secondary)' }}>헤더 태그</span>
                <Input
                  size="small"
                  value={settings.headerTags || ''}
                  onChange={(e) => onSettingChange('headerTags', e.target.value)}
                  placeholder="쉼표로 태그 구분"
                />
              </div>
              {settings.headerLayout === 'banner' && (
                <>
                  <div className="setting-field">
                    <span className="setting-field-label" style={{ fontSize: '0.85em', color: 'var(--text-secondary)' }}>배너 이미지 URL</span>
                    <Input
                      size="small"
                      value={settings.headerBannerUrl || ''}
                      onChange={(e) => onSettingChange('headerBannerUrl', e.target.value)}
                    />
                  </div>
                  <SettingToggle
                    label="블러 효과"
                    checked={settings.headerBannerBlur}
                    onChange={(v) => onSettingChange('headerBannerBlur', v)}
                  />
                  <div className="setting-field">
                    <span className="setting-field-label" style={{ fontSize: '0.85em', color: 'var(--text-secondary)' }}>이미지 정렬 ({settings.headerBannerAlign || 50}%)</span>
                    <Slider
                      min={0}
                      max={100}
                      value={settings.headerBannerAlign || 50}
                      onChange={(val) => onSettingChange('headerBannerAlign', val)}
                    />
                  </div>
                </>
              )}
            </div>
          )}

          <SettingToggle
            label="푸터"
            description="하단 정보 표시"
            checked={settings.showFooter}
            onChange={(v) => onSettingChange('showFooter', v)}
          />
          {settings.showFooter !== false && (
            <div style={{ paddingLeft: '12px', display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '2px' }}>
              <div className="setting-field">
                <span className="setting-field-label" style={{ fontSize: '0.85em', color: 'var(--text-secondary)' }}>푸터 (왼쪽)</span>
                <Input size="small" value={settings.footerLeft || ''} onChange={(e) => onSettingChange('footerLeft', e.target.value)} />
              </div>
              <div className="setting-field">
                <span className="setting-field-label" style={{ fontSize: '0.85em', color: 'var(--text-secondary)' }}>푸터 (중앙)</span>
                <Input size="small" value={settings.footerCenter || ''} onChange={(e) => onSettingChange('footerCenter', e.target.value)} />
              </div>
              <div className="setting-field">
                <span className="setting-field-label" style={{ fontSize: '0.85em', color: 'var(--text-secondary)' }}>푸터 (오른쪽)</span>
                <Input size="small" value={settings.footerRight || ''} onChange={(e) => onSettingChange('footerRight', e.target.value)} />
              </div>
            </div>
          )}
        </div>
      )}

      {settings.format === 'html' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <SettingToggle
            label="이미지 내장"
            description="이미지를 Base64로 포함"
            checked={settings.embedImages}
            onChange={(v) => onSettingChange('embedImages', v)}
          />
          <SettingToggle
            label="호버 요소 펼치기"
            checked={settings.expandHover}
            onChange={(v) => onSettingChange('expandHover', v)}
          />
        </div>
      )}
    </div>
  );

  // 3. 이미지 설정 Popover 내용
  const imageSettingsContent = (
    <div style={{ width: '290px', maxHeight: '70vh', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '16px', padding: '2px 4px 16px 2px', boxSizing: 'border-box' }} className="export-option-settings-content">
      {isBasicFormat && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <div className="setting-field">
            <span className="setting-field-label" style={{ fontSize: '0.85em', color: 'var(--text-secondary)' }}>이미지 크기 ({settings.imageScale || 100}%)</span>
            <Slider
              min={1}
              max={100}
              value={settings.imageScale || 100}
              onChange={(val) => onSettingChange('imageScale', val)}
            />
          </div>
          <div className="setting-field">
            <span className="setting-field-label" style={{ fontSize: '0.85em', color: 'var(--text-secondary)' }}>이미지 정렬</span>
            <Segmented
              size="small"
              value={settings.imageAlign || 'left'}
              onChange={(val) => onSettingChange('imageAlign', val)}
              options={[
                { label: '왼쪽', value: 'left' },
                { label: '중앙', value: 'center' },
                { label: '오른쪽', value: 'right' },
              ]}
              block
            />
          </div>
          <div className="setting-field">
            <span className="setting-field-label" style={{ fontSize: '0.85em', color: 'var(--text-secondary)' }}>이미지 스타일</span>
            <Select
              size="small"
              value={settings.imageStyle || 'none'}
              onChange={(val) => onSettingChange('imageStyle', val)}
              options={[
                { value: 'none', label: '없음' },
                { value: 'gallery', label: '갤러리' },
                { value: 'modern', label: '모던' },
                { value: 'tape', label: '테이프' },
              ]}
            />
          </div>
          <div className="setting-field" style={{ marginTop: '4px' }}>
            <SettingToggle
              label="이미지 크롭 활성화"
              checked={settings.imageCropActive || false}
              onChange={(v) => onSettingChange('imageCropActive', v)}
            />
          </div>
          {settings.imageCropActive && (
            <div style={{ paddingLeft: '12px', display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '2px' }}>
              <div className="setting-field">
                <span className="setting-field-label" style={{ fontSize: '0.85em', color: 'var(--text-secondary)' }}>크롭 비율</span>
                <Select
                  size="small"
                  value={settings.imageCropAspectRatio || 'original'}
                  onChange={(val) => onSettingChange('imageCropAspectRatio', val)}
                  options={[
                    { value: 'original', label: '원본 비율' },
                    { value: '1:1', label: '1:1 (정사각형)' },
                    { value: '3:4', label: '3:4 (인물)' },
                    { value: '4:3', label: '4:3 (가로)' },
                    { value: '9:16', label: '9:16 (세로)' },
                    { value: '16:9', label: '16:9 (시네마)' },
                    { value: 'custom', label: '사용자 지정' },
                  ]}
                />
              </div>
              {settings.imageCropAspectRatio === 'custom' && (
                <div className="setting-field">
                  <span className="setting-field-label" style={{ fontSize: '0.85em', color: 'var(--text-secondary)' }}>사용자 지정 세로 비율 ({settings.imageCropHeight || 1.0})</span>
                  <Slider
                    min={0.1}
                    max={3.0}
                    step={0.01}
                    value={settings.imageCropHeight || 1.0}
                    onChange={(val) => onSettingChange('imageCropHeight', val)}
                  />
                </div>
              )}
              {settings.imageCropAspectRatio !== 'original' && (
                <>
                  <div className="setting-field">
                    <span className="setting-field-label" style={{ fontSize: '0.85em', color: 'var(--text-secondary)' }}>세로 초점 위치 ({settings.imageCropVAlign || 50}%)</span>
                    <Slider
                      min={0}
                      max={100}
                      value={settings.imageCropVAlign !== undefined ? settings.imageCropVAlign : 50}
                      onChange={(val) => onSettingChange('imageCropVAlign', val)}
                    />
                  </div>
                  <div className="setting-field">
                    <span className="setting-field-label" style={{ fontSize: '0.85em', color: 'var(--text-secondary)' }}>가로 초점 위치 ({settings.imageCropHAlign || 50}%)</span>
                    <Slider
                      min={0}
                      max={100}
                      value={settings.imageCropHAlign !== undefined ? settings.imageCropHAlign : 50}
                      onChange={(val) => onSettingChange('imageCropHAlign', val)}
                    />
                  </div>
                </>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );

  return (
    <>
        <div className="desktop-preview-toolbar">
            <div className="desktop-selection-controls" style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                {settings.isEditable && (
                    <>
                        <Button variant="outline" size="small" onClick={onSelectAll} title="모든 메시지 선택">전체 선택</Button>
                        <Button variant="outline" size="small" onClick={onDeselectAll} title="모든 선택 해제">전체 해제</Button>
                        <Button variant="outline" size="small" onClick={onInvertSelection} title="선택 상태 반전">선택 반전</Button>
                    </>
                )}
            </div>
            <div className="desktop-export-controls" style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                {/* 2. 테마 설정 (출력 형식이 기본(basic)일 때만 표시) */}
                {isBasicFormat && (
                  <div style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
                    <span title="테마 선택"><Shirt size={14} style={{ color: 'var(--muted-foreground)' }} /></span>
                    <Select
                      size="small"
                      value={settings.theme || 'basic'}
                      onChange={(val) => onSettingChange('theme', val)}
                      style={{ width: '100px' }}
                    >
                      {Object.entries(themes).map(([key, theme]: [string, any]) =>
                        <Select.Option value={key} key={key}>{theme.name}</Select.Option>
                      )}
                    </Select>
                    {settings.theme === 'custom' && (
                      <Popover
                        content={customCssPopoverContent}
                        title="커스텀 CSS 편집"
                        trigger="click"
                        placement="bottom"
                      >
                        <Button variant="outline" size="small" icon={<Code size={13} />} title="커스텀 CSS 편집">CSS</Button>
                      </Popover>
                    )}
                  </div>
                )}

                {/* 3. 색상 설정 */}
                {isBasicFormat && (
                  <div style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
                    <span title="색상 선택"><Palette size={14} style={{ color: 'var(--muted-foreground)' }} /></span>
                    <Select
                      size="small"
                      value={settings.color || 'dark'}
                      onChange={(val) => onSettingChange('color', val)}
                      style={{ width: '90px' }}
                    >
                      {Object.entries(colors).map(([key, color]: [string, any]) =>
                        <Select.Option value={key} key={key}>{color.name}</Select.Option>
                      )}
                    </Select>
                  </div>
                )}

                {/* 4. 헤더 레이아웃 설정 */}
                {isBasicFormat && (
                  <div style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
                    <span title="헤더 레이아웃 선택"><Layout size={14} style={{ color: 'var(--muted-foreground)' }} /></span>
                    <Select
                      size="small"
                      value={settings.headerLayout || 'default'}
                      onChange={(val) => onSettingChange('headerLayout', val)}
                      style={{ width: '100px' }}
                      options={[
                        { value: 'default', label: '기본' },
                        { value: 'compact', label: '컴팩트' },
                        { value: 'banner', label: '배너' },
                        { value: 'smart', label: '스마트' },
                        { value: 'cover', label: '커버' },
                      ]}
                    />
                  </div>
                )}

                {/* 5. 표시 옵션 Popover */}
                {(isBasicFormat || settings.format === 'html') && (
                  <Popover
                      content={displayOptionsContent}
                      title="표시 옵션"
                      trigger="click"
                      placement="bottomRight"
                  >
                      <Button 
                          variant="outline"
                          size="small" 
                          icon={<Eye size={13} />} 
                          title="상세 표시 옵션 변경"
                      >
                          옵션
                      </Button>
                  </Popover>
                )}

                {/* 6. 이미지 설정 Popover */}
                {isBasicFormat && (
                  <Popover
                      content={imageSettingsContent}
                      title="이미지 설정"
                      trigger="click"
                      placement="bottomRight"
                  >
                      <Button 
                          variant="outline"
                          size="small" 
                          icon={<ImageIcon size={13} />} 
                          title="상세 이미지 설정 변경"
                      >
                          이미지
                      </Button>
                  </Popover>
                )}
            </div>
        </div>
        <div className="desktop-preview-content" ref={previewContentRef} style={{ position: 'relative', height: 'calc(100% - 45px)' }}>
            {showSpinner && (
                <div style={{
                    position: 'absolute',
                    top: 0, left: 0, right: 0, bottom: 0,
                    backgroundColor: 'rgba(9, 9, 11, 0.8)',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    zIndex: 10,
                    backdropFilter: 'blur(4px)',
                    gap: '12px',
                    borderRadius: '8px'
                }}>
                    <Spin size="large" />
                    <span style={{ color: 'var(--foreground)', fontSize: '13px', fontWeight: 500 }}>로딩 및 변환 중...</span>
                </div>
            )}
            <div className="log-exporter-modal-preview" style={{ position: 'relative', height: '100%', overflow: 'hidden' }}>
                {/* 출력 형식 토글 버튼 */}
                <div className="preview-format-toggle-container" style={{
                    position: 'absolute',
                    top: '12px',
                    left: '50%',
                    transform: 'translateX(-50%)',
                    zIndex: 10,
                    background: 'transparent',
                    display: 'flex',
                    justifyContent: 'center',
                }}>
                    <Segmented
                        value={settings.format || 'basic'}
                        onChange={(val) => onSettingChange('format', val)}
                        options={[
                          { label: '기본', value: 'basic', icon: <FileText size={13} /> },
                          { label: 'HTML', value: 'html', icon: <Code size={13} /> },
                          { label: '마크다운', value: 'markdown', icon: <FileCode size={13} /> },
                          { label: '텍스트', value: 'text', icon: <AlignLeft size={13} /> },
                        ]}
                    />
                </div>
                {/* 로그 본문 영역 */}
                <div className="preview-content-render-area" style={{ height: '100%', width: '100%', overflow: 'hidden', position: 'relative', boxSizing: 'border-box' }}>
                    {renderContent()}
                </div>
            </div>
        </div>
    </>
  );
};

export default PreviewPanel;
