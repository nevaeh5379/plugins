import React, { useState } from 'react';
import {
  FileText,
  Pencil,
  X,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import { Button } from '../../../components/ui';
import SettingsTabs from '../SettingsTabs';
import PreviewPanel from '../PreviewPanel';
import Actionbar from '../Actionbar';
import type { ThemeInfo, ColorPalette, GlobalSettings, LogContainerProps } from '../../../types';
import type { LogExporterSettings, CharInfoState, EstimatedImageSize } from '../../hooks/types';
import type { UIClassInfo } from '../../utils/domUtils';

export interface DesktopViewProps {
  charInfo: CharInfoState;
  settings: LogExporterSettings;
  globalSettings: GlobalSettings;
  onSettingChange: (key: string, value: unknown) => void;
  onGlobalSettingChange: (key: string, value: unknown) => void;
  logContainerProps: Omit<LogContainerProps, 'onReady'>;
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
  themes: Record<string, ThemeInfo>;
  colors: Record<string, ColorPalette>;
  backgroundColor: string;
  colorPalette: ColorPalette;
  onClose: () => void;
  getPreviewContentForExport: () => Promise<string>;
  nodesForExport: HTMLElement[];
  onOpenArcaHelper: () => void;
  onProgressStart: (message: string, total?: number) => void;
  onProgressUpdate: (update: { current?: number; message?: string }) => void;
  onProgressEnd: () => void;
  onSaveLogData: () => void;
  onLoadLogData: () => void;
  onDeleteSelected: () => void;
  hasSelection: boolean;
  participants: Set<string>;
  uiClasses: UIClassInfo[];
  imageSizeWarning: string;
  activeTab: string;
  onTabChange: (tab: string) => void;
}

/**
 * DesktopView - Complete desktop-optimized layout for LogExporter plugin.
 * Features a collapsible side settings panel, rich top toolbar, and desktop action bar.
 */
export const DesktopView: React.FC<DesktopViewProps> = ({
  charInfo,
  settings,
  globalSettings,
  onSettingChange,
  onGlobalSettingChange,
  logContainerProps,
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
  themes,
  colors,
  backgroundColor,
  colorPalette,
  onClose,
  getPreviewContentForExport,
  nodesForExport,
  onOpenArcaHelper,
  onProgressStart,
  onProgressUpdate,
  onProgressEnd,
  onSaveLogData,
  onLoadLogData,
  onDeleteSelected,
  hasSelection,
  participants,
  uiClasses,
  imageSizeWarning,
  activeTab,
  onTabChange,
}) => {
  const [isSettingsOpen, setIsSettingsOpen] = useState(true);

  return (
    <div className="desktop-view-root">
      {/* Desktop Header Bar */}
      <div
        className="log-exporter-modal-header-bar"
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '12px',
          padding: '12px 16px',
          borderBottom: '1px solid var(--border)',
          background: 'var(--card)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <div
            style={{
              width: '28px',
              height: '28px',
              borderRadius: '6px',
              backgroundColor: 'var(--muted)',
              border: '1px solid var(--border)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'var(--foreground)',
            }}
          >
            <FileText size={15} />
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1px' }}>
            <span
              className="header-title"
              style={{
                fontSize: '13px',
                fontWeight: 600,
                color: 'var(--foreground)',
                lineHeight: 1.2,
              }}
            >
              로그 플러그인
            </span>
          </div>
        </div>

        <div style={{ flex: 1 }} />

        {/* Edit mode toggle */}
        <button
          type="button"
          onClick={() => onSettingChange('isEditable', !settings.isEditable)}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '6px',
            padding: '5px 10px',
            fontSize: '12px',
            fontWeight: 500,
            borderRadius: 'var(--radius)',
            border: settings.isEditable ? '1px solid var(--primary)' : '1px solid var(--border)',
            backgroundColor: settings.isEditable ? 'var(--secondary)' : 'transparent',
            color: settings.isEditable ? 'var(--foreground)' : 'var(--muted-foreground)',
            cursor: 'pointer',
            transition: 'all 0.15s ease',
          }}
          title="로그 편집 활성화 토글"
          aria-pressed={settings.isEditable}
        >
          <Pencil size={13} style={{ opacity: settings.isEditable ? 1 : 0.7 }} />
        </button>

        {/* Modal close button */}
        <button
          type="button"
          id="log-exporter-close"
          onClick={onClose}
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: '28px',
            height: '28px',
            borderRadius: '6px',
            border: '1px solid var(--border)',
            backgroundColor: 'transparent',
            color: 'var(--muted-foreground)',
            cursor: 'pointer',
            transition: 'all 0.15s ease',
          }}
          title="닫기 (Esc)"
          aria-label="모달 닫기"
        >
          <X size={15} />
        </button>
      </div>

      {/* Desktop Main Content Layout */}
      <div
        className="log-exporter-modal-content"
        style={{
          display: 'flex',
          height: 'calc(100% - 53px)',
          overflow: 'hidden',
          position: 'relative',
        }}
      >
        {/* Collapsible Left Settings Panel */}
        <div
          className="desktop-settings-panel"
          style={{
            display: 'flex',
            flexDirection: 'column',
            height: '100%',
            width: isSettingsOpen ? '450px' : '0px',
            borderRight: isSettingsOpen
              ? '1px solid var(--border)'
              : '0px solid transparent',
            background: 'var(--card)',
            overflow: 'hidden',
            flexShrink: 0,
            transition: 'width 0.2s cubic-bezier(0.16, 1, 0.3, 1)',
          }}
        >
          <div
            style={{
              width: '450px',
              height: '100%',
              overflow: 'hidden',
              display: 'flex',
              flexDirection: 'column',
              flexShrink: 0,
            }}
          >
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
          </div>
        </div>

        {/* Right Preview & Action Panel */}
        <div
          className="desktop-preview-panel"
          style={{
            overflow: 'hidden',
            display: 'flex',
            flexDirection: 'column',
            height: '100%',
            position: 'relative',
            flex: 1,
          }}
        >
          {/* Sidebar Toggle Handle Button */}
          <Button
            className="sidebar-toggle-handle"
            icon={
              isSettingsOpen ? (
                <ChevronLeft size={14} />
              ) : (
                <ChevronRight size={14} />
              )
            }
            onClick={() => setIsSettingsOpen(!isSettingsOpen)}
            title={isSettingsOpen ? '설정 접기' : '설정 펼치기'}
            style={{
              position: 'absolute',
              left: 0,
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
              backgroundColor: 'var(--card)',
              borderColor: 'var(--border)',
              color: 'var(--muted-foreground)',
              boxShadow: '2px 0 8px rgba(0, 0, 0, 0.15)',
              cursor: 'pointer',
            }}
          />

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

          <div className="desktop-floating-action-bar">
            <Actionbar
              charName={charInfo.charName}
              chatName={charInfo.chatName}
              getPreviewContent={getPreviewContentForExport}
              messageNodes={nodesForExport}
              settings={settings}
              backgroundColor={backgroundColor}
              color={colorPalette}
              charAvatarUrl={charInfo.charAvatarUrl}
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
          </div>
        </div>
      </div>
    </div>
  );
};

export default DesktopView;
