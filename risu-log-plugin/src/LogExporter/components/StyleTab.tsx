/* eslint-disable @typescript-eslint/no-explicit-any */
import React from 'react';
import { Select, Input } from '../../components/ui';
import { Palette, Code, Info } from 'lucide-react';
import type { ThemeInfo, ColorPalette } from '../../types';

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
    <div className="tab-content" style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
      {/* 기본 스타일 카드 */}
      <div className="shadcn-card" style={{
        backgroundColor: 'var(--card)',
        border: '1px solid var(--border)',
        borderRadius: 'var(--radius)',
        padding: '14px 16px',
        display: 'flex',
        flexDirection: 'column',
        gap: '14px',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Palette size={16} style={{ color: 'var(--foreground)' }} />
          <h4 style={{ margin: 0, fontSize: '13px', fontWeight: 600, color: 'var(--foreground)' }}>기본 스타일</h4>
        </div>

        {/* 테마 선택 */}
        <div className="setting-field" style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
          <label style={{ fontSize: '12px', fontWeight: 500, color: 'var(--foreground)' }}>테마</label>
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

        {/* 색상 팔레트 선택 */}
        <div className="setting-field" style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
          <label style={{ fontSize: '12px', fontWeight: 500, color: 'var(--foreground)' }}>색상</label>
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

        {/* 헤더 레이아웃 선택 */}
        <div className="setting-field" style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
          <label style={{ fontSize: '12px', fontWeight: 500, color: 'var(--foreground)' }}>헤더 레이아웃</label>
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
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          padding: '10px 12px',
          borderRadius: 'var(--radius)',
          backgroundColor: 'var(--muted)',
          border: '1px solid var(--border)',
          fontSize: '12px',
          color: 'var(--muted-foreground)',
        }}>
          <Info size={14} style={{ flexShrink: 0 }} />
          <span>기본 출력 형식일 때만 스타일 테마를 적용할 수 있습니다.</span>
        </div>
      )}

      {/* 커스텀 CSS 편집 (테마가 custom일 때만 표시) */}
      {isBasicFormat && settings.theme === 'custom' && (
        <div className="shadcn-card" style={{
          backgroundColor: 'var(--card)',
          border: '1px solid var(--border)',
          borderRadius: 'var(--radius)',
          padding: '14px 16px',
          display: 'flex',
          flexDirection: 'column',
          gap: '12px',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Code size={16} style={{ color: 'var(--foreground)' }} />
            <h4 style={{ margin: 0, fontSize: '13px', fontWeight: 600, color: 'var(--foreground)' }}>커스텀 CSS</h4>
          </div>

          <TextArea
            value={settings.customCss || ''}
            onChange={(e) => onSettingChange('customCss', e.target.value)}
            placeholder="여기에 커스텀 CSS 코드를 입력하세요..."
            autoSize={{ minRows: 6, maxRows: 12 }}
            style={{ fontFamily: 'monospace', fontSize: '12px', width: '100%' }}
          />
        </div>
      )}
    </div>
  );
};

export default StyleTab;

