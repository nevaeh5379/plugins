/* eslint-disable @typescript-eslint/no-explicit-any */
import React from 'react';
import { Select, Divider, Typography, Input } from 'antd';
import type { ThemeInfo, ColorPalette } from '../../types';

const { Title, Text } = Typography;
const { TextArea } = Input;

interface StyleTabProps {
  settings: any;
  onSettingChange: (key: string, value: any) => void;
  themes: Record<string, ThemeInfo>;
  colors: Record<string, ColorPalette>;
}

const StyleTab: React.FC<StyleTabProps> = ({
  settings,
  onSettingChange,
  themes,
  colors,
}) => {
  const isBasicFormat = settings.format === 'basic';

  return (
    <div className="tab-content">
      <div className="tab-section">
        <Title level={5} className="tab-section-title">기본 스타일</Title>
        
        {/* 테마 */}
        <div className="setting-field">
          <Text className="setting-field-label">테마</Text>
          <Select
            value={settings.theme || 'basic'}
            onChange={(val) => onSettingChange('theme', val)}
            style={{ width: '100%' }}
            disabled={!isBasicFormat}
          >
            {Object.entries(themes).map(([key, theme]: [string, any]) => (
              <Select.Option value={key} key={key}>{theme.name}</Select.Option>
            ))}
          </Select>
        </div>

        {/* 색상 */}
        <div className="setting-field" style={{ marginTop: '12px' }}>
          <Text className="setting-field-label">색상</Text>
          <Select
            value={settings.color || 'dark'}
            onChange={(val) => onSettingChange('color', val)}
            style={{ width: '100%' }}
            disabled={!isBasicFormat}
          >
            {Object.entries(colors).map(([key, palette]: [string, any]) => (
              <Select.Option value={key} key={key}>{palette.name}</Select.Option>
            ))}
          </Select>
        </div>

        {/* 레이아웃 */}
        <div className="setting-field" style={{ marginTop: '12px' }}>
          <Text className="setting-field-label">헤더 레이아웃</Text>
          <Select
            value={settings.headerLayout || 'default'}
            onChange={(val) => onSettingChange('headerLayout', val)}
            style={{ width: '100%' }}
            disabled={!isBasicFormat}
            options={[
              { value: 'default', label: '기본' },
              { value: 'compact', label: '컴팩트' },
              { value: 'banner', label: '배너' },
              { value: 'smart', label: '스마트' },
              { value: 'cover', label: '커버' },
            ]}
          />
        </div>
      </div>

      {!isBasicFormat && (
        <div style={{ marginTop: '12px', fontSize: '0.85em', color: 'var(--text-secondary)' }}>
          * 기본 출력 형식일 때만 스타일 테마를 적용할 수 있습니다.
        </div>
      )}

      {/* 커스텀 CSS 편집 (테마가 custom일 때만 표시) */}
      {isBasicFormat && settings.theme === 'custom' && (
        <>
          <Divider />
          <div className="tab-section">
            <Title level={5} className="tab-section-title">커스텀 CSS</Title>
            <div className="setting-field">
              <TextArea
                value={settings.customCss || ''}
                onChange={(e) => onSettingChange('customCss', e.target.value)}
                placeholder="여기에 CSS 코드를 입력하세요..."
                autoSize={{ minRows: 6, maxRows: 12 }}
                style={{ width: '100%' }}
              />
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default StyleTab;
