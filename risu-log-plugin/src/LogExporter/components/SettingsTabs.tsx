/* eslint-disable @typescript-eslint/no-explicit-any */
import React from 'react';
import { Filter, Replace, Palette, SlidersHorizontal, Settings } from 'lucide-react';
import type { UIClassInfo } from '../utils/domUtils';
import type { ReplacementRule, ThemeInfo, ColorPalette } from '../../types';

import FilterTab from './FilterTab';
import ReplacementTab from './ReplacementTab';
import StyleTab from './StyleTab';
import AdvancedTab from './AdvancedTab';
import PluginGlobalSettings from './PluginGlobalSettings';

export interface SettingsTabsProps {
  activeTab: string;
  onTabChange: (key: string) => void;
  settings: any;
  onSettingChange: (key: string, value: any) => void;
  participants: Set<string>;
  globalSettings: any;
  onGlobalSettingChange: (key: string, value: any) => void;
  uiClasses: UIClassInfo[];
  imageSizeWarning?: string;
  themes: Record<string, ThemeInfo>;
  colors: Record<string, ColorPalette>;
}

const TAB_ITEMS = [
  { key: 'filter', label: '필터', icon: Filter },
  { key: 'replacement', label: '바꾸기', icon: Replace },
  { key: 'style', label: '스타일', icon: Palette },
  { key: 'advanced', label: '고급', icon: SlidersHorizontal },
  { key: 'plugin', label: '플러그인', icon: Settings },
];

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
  return (
    <div className="shadcn-settings-tabs-container" style={{ display: 'flex', flexDirection: 'column', height: '100%', width: '100%', overflow: 'hidden' }}>
      {/* shadcn Tabs List */}
      <div className="shadcn-tabs-header-wrapper" style={{ padding: '12px 14px 4px 14px', flexShrink: 0 }}>
        <div className="shadcn-tabs-list" style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(5, 1fr)',
          gap: '2px',
          padding: '3px',
          backgroundColor: 'var(--muted)',
          borderRadius: 'var(--radius)',
          border: '1px solid var(--border)',
        }}>
          {TAB_ITEMS.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.key;
            return (
              <button
                key={tab.key}
                type="button"
                onClick={() => onTabChange(tab.key)}
                className={`shadcn-tab-trigger ${isActive ? 'active' : ''}`}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '5px',
                  padding: '6px 4px',
                  fontSize: '12px',
                  fontWeight: isActive ? 600 : 500,
                  color: isActive ? 'var(--foreground)' : 'var(--muted-foreground)',
                  backgroundColor: isActive ? 'var(--card)' : 'transparent',
                  borderRadius: 'calc(var(--radius) - 2px)',
                  border: 'none',
                  boxShadow: isActive ? '0 1px 3px rgba(0,0,0,0.18)' : 'none',
                  cursor: 'pointer',
                  transition: 'all 0.15s ease-in-out',
                  userSelect: 'none',
                  whiteSpace: 'nowrap',
                }}
              >
                <Icon size={14} style={{ flexShrink: 0, opacity: isActive ? 1 : 0.7 }} />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Tab Panes */}
      <div className="shadcn-tabs-content-area" style={{ flex: 1, overflowY: 'auto', minHeight: 0 }}>
        {activeTab === 'filter' && (
          <FilterTab
            settings={settings}
            onSettingChange={onSettingChange}
            participants={participants}
            globalSettings={globalSettings}
            onGlobalSettingChange={onGlobalSettingChange}
            uiClasses={uiClasses}
          />
        )}
        {activeTab === 'replacement' && (
          <ReplacementTab
            rules={(settings.replacementRules as ReplacementRule[]) || []}
            onRulesChange={(rules) => onSettingChange('replacementRules', rules)}
          />
        )}
        {activeTab === 'style' && (
          <StyleTab
            settings={settings}
            onSettingChange={onSettingChange}
            themes={themes}
            colors={colors}
          />
        )}
        {activeTab === 'advanced' && (
          <AdvancedTab
            settings={settings}
            onSettingChange={onSettingChange}
            imageSizeWarning={imageSizeWarning}
          />
        )}
        {activeTab === 'plugin' && (
          <PluginGlobalSettings
            globalSettings={globalSettings}
            onGlobalSettingChange={onGlobalSettingChange}
          />
        )}
      </div>
    </div>
  );
};

export default SettingsTabs;