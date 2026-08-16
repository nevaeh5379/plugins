import React from 'react';
import { Palette, Check, Layout, Eye, X } from 'lucide-react';
import type { ThemeInfo, ColorPalette } from '../../../types';
import type { LogExporterSettings } from '../../hooks/types';
import { HEADER_LAYOUT_OPTIONS } from '../constants';
import SettingToggle from '../SettingToggle';

export interface MobileQuickStyleSheetProps {
  open: boolean;
  onClose: () => void;
  settings: LogExporterSettings;
  onSettingChange: (key: string, value: unknown) => void;
  themes: Record<string, ThemeInfo>;
  colors: Record<string, ColorPalette>;
  dataTheme?: string;
}

/**
 * Mobile Quick Style Sheet - A bottom drawer tailored for mobile devices
 * enabling rapid changes to theme, color palette, header layout, and display toggles
 * without needing to navigate into the full settings drawer.
 */
export const MobileQuickStyleSheet: React.FC<MobileQuickStyleSheetProps> = ({
  open,
  onClose,
  settings,
  onSettingChange,
  themes,
  colors,
}) => {
  if (!open) return null;

  const currentTheme = settings.theme || 'basic';
  const currentColor = typeof settings.color === 'string' ? settings.color : 'dark';
  const currentHeaderLayout = settings.headerLayout || 'default';

  return (
    <div className="mobile-sheet-backdrop" onClick={onClose}>
      <div
        className="mobile-sheet-content"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label="빠른 스타일 설정"
      >
        {/* Grabber handle */}
        <div className="mobile-sheet-grabber-wrapper">
          <div className="mobile-sheet-grabber" />
        </div>

        {/* Sheet Header */}
        <div className="mobile-sheet-header">
          <div className="mobile-sheet-title-group">
            <Palette size={16} className="text-primary" />
            <h3 className="mobile-sheet-title">빠른 스타일 설정</h3>
          </div>
          <button
            type="button"
            className="mobile-sheet-close-btn"
            onClick={onClose}
            aria-label="닫기"
          >
            <X size={16} />
          </button>
        </div>

        {/* Sheet Scrollable Body */}
        <div className="mobile-sheet-body">
          {/* Section 1: Themes */}
          <div className="mobile-sheet-section">
            <div className="mobile-sheet-section-header">
              <span className="mobile-sheet-section-title">테마 선택</span>
              <span className="mobile-sheet-section-subtitle">
                {themes[currentTheme]?.name || currentTheme}
              </span>
            </div>
            <div className="mobile-sheet-horizontal-scroll">
              {Object.entries(themes).map(([key, theme]) => {
                const isSelected = currentTheme === key;
                return (
                  <button
                    key={key}
                    type="button"
                    className={`mobile-theme-chip ${isSelected ? 'selected' : ''}`}
                    onClick={() => onSettingChange('theme', key)}
                  >
                    <span className="mobile-theme-name">{theme.name}</span>
                    {isSelected && <Check size={12} className="mobile-check-icon" />}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Section 2: Color Palette */}
          <div className="mobile-sheet-section">
            <div className="mobile-sheet-section-header">
              <span className="mobile-sheet-section-title">색상 팔레트</span>
              <span className="mobile-sheet-section-subtitle">
                {colors[currentColor]?.name || currentColor}
              </span>
            </div>
            <div className="mobile-sheet-horizontal-scroll">
              {Object.entries(colors).map(([key, color]) => {
                const isSelected = currentColor === key;
                return (
                  <button
                    key={key}
                    type="button"
                    className={`mobile-color-chip ${isSelected ? 'selected' : ''}`}
                    onClick={() => onSettingChange('color', key)}
                  >
                    <span
                      className="mobile-color-dot"
                      style={{
                        backgroundColor: color.cardBgUser || color.background || '#3b82f6',
                      }}
                    />
                    <span className="mobile-color-name">{color.name}</span>
                    {isSelected && <Check size={12} className="mobile-check-icon" />}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Section 3: Header Layout */}
          <div className="mobile-sheet-section">
            <div className="mobile-sheet-section-header">
              <div className="flex items-center gap-1.5">
                <Layout size={14} className="text-muted-foreground" />
                <span className="mobile-sheet-section-title">헤더 레이아웃</span>
              </div>
            </div>
            <div className="mobile-header-layout-grid">
              {HEADER_LAYOUT_OPTIONS.map((layout) => {
                const isSelected = currentHeaderLayout === layout.value;
                return (
                  <button
                    key={layout.value}
                    type="button"
                    className={`mobile-layout-btn ${isSelected ? 'selected' : ''}`}
                    onClick={() => onSettingChange('headerLayout', layout.value)}
                  >
                    <span className="mobile-layout-label">{layout.label}</span>
                    <span className="mobile-layout-desc">{layout.description}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Section 4: Quick Display Toggles */}
          <div className="mobile-sheet-section">
            <div className="mobile-sheet-section-header">
              <div className="flex items-center gap-1.5">
                <Eye size={14} className="text-muted-foreground" />
                <span className="mobile-sheet-section-title">빠른 표시 설정</span>
              </div>
            </div>
            <div className="mobile-toggles-card">
              <SettingToggle
                label="헤더 표시"
                description="상단 캐릭터 정보 및 타이틀 영역을 표시합니다."
                checked={settings.showHeader ?? true}
                onChange={(val) => onSettingChange('showHeader', val)}
              />
              <SettingToggle
                label="푸터 표시"
                description="하단 로고 및 정보 영역을 표시합니다."
                checked={settings.showFooter ?? true}
                onChange={(val) => onSettingChange('showFooter', val)}
              />
              <SettingToggle
                label="아바타 표시"
                description="캐릭터 및 사용자 프로필 이미지를 표시합니다."
                checked={settings.showAvatar ?? true}
                onChange={(val) => onSettingChange('showAvatar', val)}
              />
              <SettingToggle
                label="말풍선 표시"
                description="메시지 내용 주변에 말풍선 박스를 표시합니다."
                checked={settings.showBubble ?? true}
                onChange={(val) => onSettingChange('showBubble', val)}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default MobileQuickStyleSheet;
