/* eslint-disable @typescript-eslint/no-explicit-any */
import React from 'react';
import { Tabs } from 'antd';
import { FilterOutlined, TranslationOutlined, SlidersOutlined, SettingOutlined } from '@ant-design/icons';
import type { UIClassInfo } from '../utils/domUtils';
import type { ReplacementRule } from '../../types';

import FilterTab from './FilterTab';
import ReplacementTab from './ReplacementTab';
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
}

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
}) => {
  const items = [
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
          settings={settings}
          onSettingChange={onSettingChange}
          participants={participants}
          globalSettings={globalSettings}
          onGlobalSettingChange={onGlobalSettingChange}
          uiClasses={uiClasses}
        />
      ),
    },
    {
      key: 'replacement',
      label: (
        <span>
          <TranslationOutlined />
          바꾸기
        </span>
      ),
      children: (
        <ReplacementTab
          rules={(settings.replacementRules as ReplacementRule[]) || []}
          onRulesChange={(rules) => onSettingChange('replacementRules', rules)}
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
          settings={settings}
          onSettingChange={onSettingChange}
          imageSizeWarning={imageSizeWarning}
        />
      ),
    },
    {
      key: 'plugin',
      label: (
        <span>
          <SettingOutlined />
          플러그인
        </span>
      ),
      children: (
        <PluginGlobalSettings
          globalSettings={globalSettings}
          onGlobalSettingChange={onGlobalSettingChange}
        />
      ),
    },
  ];

  return (
    <Tabs
      activeKey={activeTab}
      onChange={onTabChange}
      style={{ height: '100%', display: 'flex', flexDirection: 'column' }}
      tabBarStyle={{ padding: '0 16px', margin: 0 }}
      items={items}
    />
  );
};

export default SettingsTabs;