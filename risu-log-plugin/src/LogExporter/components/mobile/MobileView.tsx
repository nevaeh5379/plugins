import React from 'react';
import {
  FileText,
  Pencil,
  Settings as SettingIcon,
  X,
} from 'lucide-react';
import MobileActionBar from './MobileActionBar';
import MobileSettingsDrawer from './MobileSettingsDrawer';
import PreviewPanel from '../PreviewPanel';
import type { ThemeInfo, ColorPalette, GlobalSettings, LogContainerProps } from '../../../types';
import type { LogExporterSettings, CharInfoState, EstimatedImageSize } from '../../hooks/types';
import type { UIClassInfo } from '../../utils/domUtils';

export interface MobileViewProps {
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
  uiTheme: string;
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
  isSettingsDrawerOpen: boolean;
  setIsSettingsDrawerOpen: (open: boolean) => void;
}

/**
 * MobileView - Complete mobile-optimized layout for LogExporter plugin.
 * Features an ergonomic mobile app header, quick style bottom sheet,
 * mobile thumb-zone action bar, and touch-optimized settings drawer.
 */
export const MobileView: React.FC<MobileViewProps> = ({
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
  uiTheme,
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
  isSettingsDrawerOpen,
  setIsSettingsDrawerOpen,
}) => {
  return (
    <div className="mobile-view-root" data-theme={uiTheme}>
      {/* Mobile App Bar */}
      <header className="mobile-app-bar">
        <div className="mobile-app-bar-brand">
          <div className="mobile-brand-icon-box">
            <FileText size={16} />
          </div>
          <span className="mobile-brand-title">로그 플러그인</span>
        </div>

        <div className="mobile-app-bar-actions">
          {/* Edit Mode Toggle */}
          <button
            type="button"
            onClick={() => onSettingChange('isEditable', !settings.isEditable)}
            className={`mobile-header-btn ${settings.isEditable ? 'active' : ''}`}
            title="로그 편집 모드 토글"
            aria-label="로그 편집 모드 토글"
            aria-pressed={settings.isEditable}
          >
            <Pencil size={15} />
          </button>

          {/* Settings Drawer Trigger */}
          <button
            type="button"
            onClick={() => setIsSettingsDrawerOpen(true)}
            className="mobile-header-btn"
            title="설정 열기"
            aria-label="설정 열기"
          >
            <SettingIcon size={15} />
          </button>

          {/* Close Modal Button */}
          <button
            type="button"
            id="log-exporter-close"
            onClick={onClose}
            className="mobile-header-btn mobile-close-btn"
            title="닫기"
            aria-label="닫기"
          >
            <X size={16} />
          </button>
        </div>
      </header>

      {/* Main Preview Tab Content */}
      <main
        className="mobile-preview-tab"
        style={{
          flex: 1,
          minHeight: 0,
          width: '100%',
          position: 'relative',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
        }}
      >
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

        {/* Mobile Ergonomic Thumb-zone Action Bar */}
        <MobileActionBar
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
          selectedCount={selectedIndices.size}
          onSelectAll={onSelectAll}
          onDeselectAll={onDeselectAll}
          onInvertSelection={onInvertSelection}
        />
      </main>

      {/* Full Mobile Settings Drawer */}
      <MobileSettingsDrawer
        open={isSettingsDrawerOpen}
        onClose={() => setIsSettingsDrawerOpen(false)}
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
        dataTheme={uiTheme}
      />
    </div>
  );
};

export default MobileView;
