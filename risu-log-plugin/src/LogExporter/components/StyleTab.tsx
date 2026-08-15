import React, { useMemo, useCallback } from 'react';
import { Palette, Code, Info, Layout } from 'lucide-react';
import { Select, Input } from '../../components/ui';
import type { ThemeInfo, ColorPalette, LogExportSettings } from '../../types';

const { TextArea } = Input;

// ─── Types & Interfaces ───────────────────────────────────────────────────────

export interface StyleTabProps {
  /** Current export configuration settings */
  settings: Partial<LogExportSettings> & Record<string, unknown>;
  /** Callback to update a specific setting key */
  onSettingChange: (key: string, value: unknown) => void;
  /** Available theme definitions keyed by theme identifier */
  themes: Record<string, ThemeInfo>;
  /** Available color palettes keyed by palette identifier */
  colors: Record<string, ColorPalette>;
}

/** Header layout option descriptors */
interface HeaderLayoutOption {
  value: string;
  label: string;
  description: string;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const HEADER_LAYOUT_OPTIONS: readonly HeaderLayoutOption[] = [
  { value: 'default', label: '기본', description: '표준 상단 프로필 및 태그 레이아웃입니다.' },
  { value: 'compact', label: '컴팩트', description: '간결하게 한 줄로 요약된 컴팩트 레이아웃입니다.' },
  { value: 'banner', label: '배너', description: '상단 와이드 배너 이미지가 포함된 레이아웃입니다.' },
  { value: 'smart', label: '스마트', description: '세련된 글래스모피즘 스타일의 스마트 레이아웃입니다.' },
  { value: 'cover', label: '커버', description: '캐릭터 카드를 전면에 배치하는 커버 레이아웃입니다.' },
];

const DEFAULT_THEME_KEY = 'basic';
const DEFAULT_COLOR_KEY = 'dark';
const DEFAULT_HEADER_LAYOUT = 'default';

// ─── Sub-Components ───────────────────────────────────────────────────────────

/**
 * Visual swatch badge for a color with an optional label.
 */
const ColorSwatchDot: React.FC<{ color: string; label?: string }> = React.memo(({ color, label }) => (
  <span
    title={label ? `${label}: ${color}` : color}
    style={{
      display: 'inline-flex',
      alignItems: 'center',
      gap: '4px',
      padding: label ? '2px 6px' : '0',
      borderRadius: label ? '4px' : '50%',
      backgroundColor: label ? 'var(--card)' : 'transparent',
      border: label ? '1px solid var(--border)' : 'none',
      fontSize: '11px',
      color: 'var(--foreground)',
    }}
  >
    <span
      style={{
        width: '10px',
        height: '10px',
        borderRadius: '50%',
        backgroundColor: color,
        border: '1px solid rgba(128, 128, 128, 0.35)',
        flexShrink: 0,
      }}
    />
    {label && <span>{label}</span>}
  </span>
));
ColorSwatchDot.displayName = 'ColorSwatchDot';

/**
 * Active color palette preview strip showing background, card, text, and accent swatches.
 */
const ActivePalettePreview: React.FC<{ palette: ColorPalette }> = React.memo(({ palette }) => (
  <div
    style={{
      display: 'flex',
      alignItems: 'center',
      gap: '8px',
      padding: '8px 10px',
      borderRadius: 'calc(var(--radius) - 2px)',
      backgroundColor: 'var(--muted)',
      border: '1px solid var(--border)',
      marginTop: '2px',
    }}
  >
    <span style={{ fontSize: '11px', color: 'var(--muted-foreground)', flexShrink: 0 }}>
      팔레트 미리보기:
    </span>
    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap', flex: 1 }}>
      <ColorSwatchDot color={palette.background} label="배경" />
      <ColorSwatchDot color={palette.cardBg} label="카드" />
      <ColorSwatchDot color={palette.text} label="텍스트" />
      <ColorSwatchDot color={palette.nameColor} label="강조" />
    </div>
  </div>
));
ActivePalettePreview.displayName = 'ActivePalettePreview';

// ─── Main Component ───────────────────────────────────────────────────────────

/**
 * StyleTab allows users to customize visual themes, color palettes, header layouts,
 * and custom CSS stylesheets for chat log export.
 */
const StyleTab: React.FC<StyleTabProps> = ({
  settings,
  onSettingChange,
  themes,
  colors,
}) => {
  // Format check: style themes only apply to the standard basic format
  const isBasicFormat = (settings.format || 'basic') === 'basic';

  const selectedThemeKey = (settings.theme as string) || DEFAULT_THEME_KEY;
  const selectedColorKey = typeof settings.color === 'string' ? settings.color : DEFAULT_COLOR_KEY;
  const selectedHeaderLayout = (settings.headerLayout as string) || DEFAULT_HEADER_LAYOUT;

  // Active theme and color info
  const activeTheme = themes[selectedThemeKey];
  const activePalette = useMemo<ColorPalette | undefined>(() => {
    if (typeof settings.color === 'object' && settings.color !== null) {
      return settings.color as ColorPalette;
    }
    return colors[selectedColorKey] || colors[DEFAULT_COLOR_KEY];
  }, [colors, selectedColorKey, settings.color]);

  // Active header layout descriptor
  const activeHeaderLayout = useMemo(() => {
    return HEADER_LAYOUT_OPTIONS.find((opt) => opt.value === selectedHeaderLayout) || HEADER_LAYOUT_OPTIONS[0];
  }, [selectedHeaderLayout]);

  // ── Handlers ──
  const handleThemeChange = useCallback(
    (value: unknown) => {
      onSettingChange('theme', value);
    },
    [onSettingChange]
  );

  const handleColorChange = useCallback(
    (value: unknown) => {
      onSettingChange('color', value);
    },
    [onSettingChange]
  );

  const handleHeaderLayoutChange = useCallback(
    (value: unknown) => {
      onSettingChange('headerLayout', value);
    },
    [onSettingChange]
  );

  const handleCustomCssChange = useCallback(
    (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      onSettingChange('customCss', e.target.value);
    },
    [onSettingChange]
  );

  // ── Select Options Memoization ──
  const themeOptions = useMemo(() => {
    return Object.entries(themes).map(([key, theme]) => ({
      value: key,
      label: theme.name || key,
    }));
  }, [themes]);

  const colorOptions = useMemo(() => {
    return Object.entries(colors).map(([key, palette]) => ({
      value: key,
      label: (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            width: '100%',
            gap: '8px',
          }}
        >
          <span>{palette.name || key}</span>
          <div style={{ display: 'flex', gap: '3px', alignItems: 'center', flexShrink: 0 }}>
            <span
              style={{
                width: '8px',
                height: '8px',
                borderRadius: '50%',
                backgroundColor: palette.background,
                border: '1px solid rgba(128, 128, 128, 0.4)',
              }}
            />
            <span
              style={{
                width: '8px',
                height: '8px',
                borderRadius: '50%',
                backgroundColor: palette.cardBg,
                border: '1px solid rgba(128, 128, 128, 0.4)',
              }}
            />
            <span
              style={{
                width: '8px',
                height: '8px',
                borderRadius: '50%',
                backgroundColor: palette.nameColor,
                border: '1px solid rgba(128, 128, 128, 0.4)',
              }}
            />
          </div>
        </div>
      ),
    }));
  }, [colors]);

  const headerLayoutOptions = useMemo(() => {
    return HEADER_LAYOUT_OPTIONS.map((opt) => ({
      value: opt.value,
      label: opt.label,
    }));
  }, []);

  return (
    <div className="tab-content" style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
      {/* ── 기본 스타일 설정 카드 ── */}
      <div
        className="shadcn-card"
        style={{
          backgroundColor: 'var(--card)',
          border: '1px solid var(--border)',
          borderRadius: 'var(--radius)',
          padding: '14px 16px',
          display: 'flex',
          flexDirection: 'column',
          gap: '14px',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Palette size={16} style={{ color: 'var(--foreground)' }} />
          <h4 style={{ margin: 0, fontSize: '13px', fontWeight: 600, color: 'var(--foreground)' }}>기본 스타일</h4>
        </div>

        {/* 테마 선택 */}
        <div className="setting-field" style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
          <label style={{ fontSize: '12px', fontWeight: 500, color: 'var(--foreground)' }}>테마</label>
          <Select
            value={selectedThemeKey}
            onChange={handleThemeChange}
            options={themeOptions}
            style={{ width: '100%' }}
            disabled={!isBasicFormat}
          />
          {activeTheme?.description && (
            <p style={{ margin: '2px 0 0 0', fontSize: '11px', color: 'var(--muted-foreground)', lineHeight: 1.4 }}>
              {activeTheme.description}
            </p>
          )}
        </div>

        {/* 색상 팔레트 선택 */}
        <div className="setting-field" style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
          <label style={{ fontSize: '12px', fontWeight: 500, color: 'var(--foreground)' }}>색상 팔레트</label>
          <Select
            value={selectedColorKey}
            onChange={handleColorChange}
            options={colorOptions}
            style={{ width: '100%' }}
            disabled={!isBasicFormat}
          />
          {activePalette && <ActivePalettePreview palette={activePalette} />}
        </div>
      </div>

      {/* ── 헤더 레이아웃 카드 ── */}
      <div
        className="shadcn-card"
        style={{
          backgroundColor: 'var(--card)',
          border: '1px solid var(--border)',
          borderRadius: 'var(--radius)',
          padding: '14px 16px',
          display: 'flex',
          flexDirection: 'column',
          gap: '14px',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Layout size={16} style={{ color: 'var(--foreground)' }} />
          <h4 style={{ margin: 0, fontSize: '13px', fontWeight: 600, color: 'var(--foreground)' }}>헤더 레이아웃</h4>
        </div>

        <div className="setting-field" style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
          <label style={{ fontSize: '12px', fontWeight: 500, color: 'var(--foreground)' }}>레이아웃 스타일</label>
          <Select
            value={selectedHeaderLayout}
            onChange={handleHeaderLayoutChange}
            options={headerLayoutOptions}
            style={{ width: '100%' }}
            disabled={!isBasicFormat}
          />
          {activeHeaderLayout?.description && (
            <p style={{ margin: '2px 0 0 0', fontSize: '11px', color: 'var(--muted-foreground)', lineHeight: 1.4 }}>
              {activeHeaderLayout.description}
            </p>
          )}
        </div>
      </div>

      {/* ── 비기본 포맷 안내 배너 ── */}
      {!isBasicFormat && (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            padding: '10px 12px',
            borderRadius: 'var(--radius)',
            backgroundColor: 'var(--muted)',
            border: '1px solid var(--border)',
            fontSize: '12px',
            color: 'var(--muted-foreground)',
          }}
        >
          <Info size={14} style={{ flexShrink: 0 }} />
          <span>기본 출력 형식일 때만 스타일 테마 및 팔레트를 적용할 수 있습니다.</span>
        </div>
      )}

      {/* ── 커스텀 CSS 편집기 (테마가 custom일 때만 표시) ── */}
      {isBasicFormat && selectedThemeKey === 'custom' && (
        <div
          className="shadcn-card"
          style={{
            backgroundColor: 'var(--card)',
            border: '1px solid var(--border)',
            borderRadius: 'var(--radius)',
            padding: '14px 16px',
            display: 'flex',
            flexDirection: 'column',
            gap: '12px',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Code size={16} style={{ color: 'var(--foreground)' }} />
            <h4 style={{ margin: 0, fontSize: '13px', fontWeight: 600, color: 'var(--foreground)' }}>커스텀 CSS</h4>
          </div>

          <p style={{ margin: 0, fontSize: '12px', color: 'var(--muted-foreground)', lineHeight: 1.4 }}>
            출력물 및 미리보기에 적용할 사용자 정의 CSS 코드를 입력하세요.
          </p>

          <TextArea
            value={(settings.customCss as string) || ''}
            onChange={handleCustomCssChange}
            placeholder="여기에 커스텀 CSS 코드를 입력하세요... (예: .chat-message-container { border-radius: 12px; })"
            autoSize={{ minRows: 6, maxRows: 14 }}
            style={{ fontFamily: 'monospace', fontSize: '12px', width: '100%' }}
          />
        </div>
      )}
    </div>
  );
};

export default React.memo(StyleTab);
