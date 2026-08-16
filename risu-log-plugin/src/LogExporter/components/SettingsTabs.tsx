/* eslint-disable @typescript-eslint/no-explicit-any */
import React, { useCallback, useMemo, useRef } from 'react';
import { Filter, Replace, Palette, SlidersHorizontal, Settings } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

import type { UIClassInfo } from '../utils/domUtils';
import type { ReplacementRule, ThemeInfo, ColorPalette } from '../../types';

import FilterTab from './FilterTab';
import ReplacementTab from './ReplacementTab';
import StyleTab from './StyleTab';
import AdvancedTab from './AdvancedTab';
import PluginGlobalSettings from './PluginGlobalSettings';

// ─── Types & Constants ────────────────────────────────────────────────────────

/** Supported setting tab identifiers */
export type SettingsTabKey = 'filter' | 'replacement' | 'style' | 'advanced' | 'plugin';

/** Tab descriptor configuration */
export interface TabItemConfig {
  readonly key: SettingsTabKey;
  readonly label: string;
  readonly icon: LucideIcon;
  readonly ariaLabel?: string;
}

/** SettingsTabs component props */
export interface SettingsTabsProps {
  /** Identifier of the currently active tab */
  activeTab: SettingsTabKey | string;
  /** Callback fired when the active tab changes */
  onTabChange: (key: string) => void;
  /** Log exporter settings object */
  settings: any;
  /** Callback fired when a setting value changes */
  onSettingChange: (key: string, value: any) => void;
  /** Set of unique participant names identified from chat logs */
  participants: Set<string>;
  /** Global plugin settings object */
  globalSettings: any;
  /** Callback fired when a global setting value changes */
  onGlobalSettingChange: (key: string, value: any) => void;
  /** Detected DOM UI classes */
  uiClasses: UIClassInfo[];
  /** Optional warning message related to image dimensions */
  imageSizeWarning?: string;
  /** Available theme definitions */
  themes: Record<string, ThemeInfo>;
  /** Available color palette definitions */
  colors: Record<string, ColorPalette>;
}

/** Tab definitions for settings navigation */
const TAB_ITEMS: readonly TabItemConfig[] = [
  { key: 'filter', label: '필터', icon: Filter, ariaLabel: '필터 설정' },
  { key: 'replacement', label: '바꾸기', icon: Replace, ariaLabel: '문자열 바꾸기 설정' },
  { key: 'style', label: '스타일', icon: Palette, ariaLabel: '테마 및 스타일 설정' },
  { key: 'advanced', label: '고급', icon: SlidersHorizontal, ariaLabel: '고급 설정' },
  { key: 'plugin', label: '플러그인', icon: Settings, ariaLabel: '플러그인 전역 설정' },
] as const;

const EMPTY_RULES: ReplacementRule[] = [];

// ─── Style Constants ──────────────────────────────────────────────────────────

const CONTAINER_STYLE: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  height: '100%',
  width: '100%',
  overflow: 'hidden',
};

const HEADER_WRAPPER_STYLE: React.CSSProperties = {
  padding: '12px 14px 4px 14px',
  flexShrink: 0,
};

const TAB_LIST_STYLE: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(5, minmax(0, 1fr))',
  gap: '2px',
  padding: '3px',
  backgroundColor: 'var(--muted)',
  borderRadius: 'var(--radius)',
  border: '1px solid var(--border)',
};

const CONTENT_AREA_STYLE: React.CSSProperties = {
  flex: 1,
  overflowY: 'auto',
  minHeight: 0,
  position: 'relative',
};

const getTabTriggerStyle = (isActive: boolean): React.CSSProperties => ({
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  gap: '5px',
  padding: '6px 4px',
  minWidth: 0,
  fontSize: '12px',
  fontWeight: isActive ? 600 : 500,
  color: isActive ? 'var(--foreground)' : 'var(--muted-foreground)',
  backgroundColor: isActive ? 'var(--card)' : 'transparent',
  borderRadius: 'calc(var(--radius) - 2px)',
  border: 'none',
  boxShadow: isActive ? '0 1px 3px rgba(0, 0, 0, 0.18)' : 'none',
  cursor: 'pointer',
  transition: 'all 0.15s ease-in-out',
  userSelect: 'none',
  WebkitUserSelect: 'none',
  caretColor: 'transparent',
  whiteSpace: 'nowrap',
});

const getTabIconStyle = (isActive: boolean): React.CSSProperties => ({
  flexShrink: 0,
  opacity: isActive ? 1 : 0.7,
});

const TAB_LABEL_STYLE: React.CSSProperties = {
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
  minWidth: 0,
};

const getTabPanelStyle = (isActive: boolean): React.CSSProperties => ({
  display: isActive ? 'block' : 'none',
  height: '100%',
});

// ─── Subcomponents ────────────────────────────────────────────────────────────

interface TabTriggerProps {
  tab: TabItemConfig;
  isActive: boolean;
  onSelect: (key: string) => void;
}

/** Individual accessible tab button component */
const TabTrigger: React.FC<TabTriggerProps> = React.memo(({ tab, isActive, onSelect }) => {
  const Icon = tab.icon;

  const handleClick = useCallback(() => {
    onSelect(tab.key);
  }, [onSelect, tab.key]);

  return (
    <button
      id={`settings-tab-trigger-${tab.key}`}
      type="button"
      role="tab"
      aria-selected={isActive}
      aria-controls={`settings-tabpanel-${tab.key}`}
      aria-label={tab.ariaLabel || tab.label}
      tabIndex={isActive ? 0 : -1}
      onClick={handleClick}
      title={tab.label}
      className={`shadcn-tab-trigger ${isActive ? 'active' : ''}`}
      style={getTabTriggerStyle(isActive)}
    >
      <Icon size={14} style={getTabIconStyle(isActive)} />
      <span style={TAB_LABEL_STYLE}>{tab.label}</span>
    </button>
  );
});

TabTrigger.displayName = 'TabTrigger';

// ─── Main Component ───────────────────────────────────────────────────────────

/**
 * SettingsTabs renders the tab navigation header and lazy-mounts settings panels.
 * 
 * Features:
 * - Lazy mounting: panels are mounted upon first activation and retained to preserve user input state.
 * - Accessible WAI-ARIA tablist/tab/tabpanel markup and arrow-key keyboard navigation.
 * - Responsive tab headers with text-overflow truncation for compact widths.
 */
const SettingsTabs: React.FC<SettingsTabsProps> = ({
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
}) => {
  // Track visited tabs to mount panes on-demand (lazy) and preserve their internal DOM/state once mounted
  const visitedTabsRef = useRef<Set<string>>(new Set([activeTab]));
  visitedTabsRef.current.add(activeTab);

  // Memoize replacement rules array to avoid creating new empty arrays on each render
  const replacementRules = useMemo<ReplacementRule[]>(() => {
    return (settings?.replacementRules as ReplacementRule[]) || EMPTY_RULES;
  }, [settings?.replacementRules]);

  // Memoized change handler for replacement rules
  const handleRulesChange = useCallback(
    (rules: ReplacementRule[]) => {
      onSettingChange('replacementRules', rules);
    },
    [onSettingChange]
  );

  // Accessible keyboard navigation across tab triggers
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLDivElement>) => {
      const currentIndex = TAB_ITEMS.findIndex((t) => t.key === activeTab);
      if (currentIndex === -1) return;

      let targetIndex: number | null = null;

      switch (e.key) {
        case 'ArrowRight':
        case 'ArrowDown':
          e.preventDefault();
          targetIndex = (currentIndex + 1) % TAB_ITEMS.length;
          break;
        case 'ArrowLeft':
        case 'ArrowUp':
          e.preventDefault();
          targetIndex = (currentIndex - 1 + TAB_ITEMS.length) % TAB_ITEMS.length;
          break;
        case 'Home':
          e.preventDefault();
          targetIndex = 0;
          break;
        case 'End':
          e.preventDefault();
          targetIndex = TAB_ITEMS.length - 1;
          break;
      }

      if (targetIndex !== null) {
        const nextTab = TAB_ITEMS[targetIndex];
        onTabChange(nextTab.key);
        const element = document.getElementById(`settings-tab-trigger-${nextTab.key}`);
        element?.focus();
      }
    },
    [activeTab, onTabChange]
  );

  /** Render individual tab content pane based on tab key */
  const renderTabContent = (tabKey: string) => {
    switch (tabKey) {
      case 'filter':
        return (
          <FilterTab
            settings={settings}
            onSettingChange={onSettingChange}
            participants={participants}
            globalSettings={globalSettings}
            onGlobalSettingChange={onGlobalSettingChange}
            uiClasses={uiClasses}
          />
        );
      case 'replacement':
        return (
          <ReplacementTab
            rules={replacementRules}
            onRulesChange={handleRulesChange}
          />
        );
      case 'style':
        return (
          <StyleTab
            settings={settings}
            onSettingChange={onSettingChange}
            themes={themes}
            colors={colors}
          />
        );
      case 'advanced':
        return (
          <AdvancedTab
            settings={settings}
            onSettingChange={onSettingChange}
            imageSizeWarning={imageSizeWarning}
          />
        );
      case 'plugin':
        return (
          <PluginGlobalSettings
            globalSettings={globalSettings}
            onGlobalSettingChange={onGlobalSettingChange}
          />
        );
      default:
        return null;
    }
  };

  return (
    <div className="shadcn-settings-tabs-container" style={CONTAINER_STYLE}>
      {/* shadcn Tabs List */}
      <div className="shadcn-tabs-header-wrapper" style={HEADER_WRAPPER_STYLE}>
        <div
          role="tablist"
          aria-label="설정 탭 목록"
          aria-orientation="horizontal"
          onKeyDown={handleKeyDown}
          className="shadcn-tabs-list"
          style={TAB_LIST_STYLE}
        >
          {TAB_ITEMS.map((tab) => (
            <TabTrigger
              key={tab.key}
              tab={tab}
              isActive={activeTab === tab.key}
              onSelect={onTabChange}
            />
          ))}
        </div>
      </div>

      {/* Tab Panes (Lazy mounted & retained) */}
      <div className="shadcn-tabs-content-area" style={CONTENT_AREA_STYLE}>
        {TAB_ITEMS.map((tab) => {
          if (!visitedTabsRef.current.has(tab.key)) {
            return null;
          }

          const isActive = activeTab === tab.key;

          return (
            <div
              key={tab.key}
              id={`settings-tabpanel-${tab.key}`}
              role="tabpanel"
              aria-labelledby={`settings-tab-trigger-${tab.key}`}
              hidden={!isActive}
              style={getTabPanelStyle(isActive)}
            >
              {renderTabContent(tab.key)}
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default React.memo(SettingsTabs);