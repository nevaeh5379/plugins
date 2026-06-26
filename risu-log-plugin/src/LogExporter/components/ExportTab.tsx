import React from 'react';
import { Segmented, Select, Switch, Input, Slider, InputNumber, Divider } from 'antd';
import { FileTextOutlined, CodeOutlined, FileMarkdownOutlined, AlignLeftOutlined } from '@ant-design/icons';

interface ExportTabProps {
  settings: any;
  onSettingChange: (key: string, value: any) => void;
  themes: any;
  colors: any;
}

const ExportTab: React.FC<ExportTabProps> = ({ settings, onSettingChange, themes, colors }) => {
  
  const handleFormatChange = (format: any) => {
    onSettingChange('format', format);
  };

  const Toggle: React.FC<{ settingKey: string, label: string, value: any, defaultOn?: boolean, description?: string }> = ({ 
    settingKey, label, value, defaultOn = true, description 
  }) => {
    const isChecked = defaultOn ? value !== false : value === true;
    return (
      <div className="tab-option-row" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', margin: '12px 0' }}>
        <div className="option-info" style={{ display: 'flex', flexDirection: 'column' }}>
          <span className="option-label" style={{ fontWeight: '500' }}>{label}</span>
          {description && <span className="option-description" style={{ fontSize: '0.85em', color: 'var(--text-secondary)' }}>{description}</span>}
        </div>
        <Switch checked={isChecked} onChange={(checked) => onSettingChange(settingKey, checked)} />
      </div>
    );
  };

  return (
    <div className="tab-content" style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      {/* 출력 형식 */}
      <div className="tab-section">
        <h4 className="tab-section-title" style={{ margin: '0 0 12px 0', fontSize: '1.1em', fontWeight: 'bold' }}>출력 형식</h4>
        <Segmented
          value={settings.format || 'basic'}
          onChange={handleFormatChange}
          options={[
            { label: '기본', value: 'basic', icon: <FileTextOutlined /> },
            { label: 'HTML', value: 'html', icon: <CodeOutlined /> },
            { label: '마크다운', value: 'markdown', icon: <FileMarkdownOutlined /> },
            { label: '텍스트', value: 'text', icon: <AlignLeftOutlined /> },
          ]}
          block
        />
      </div>

      {/* 기본 형식 설정 */}
      {(settings.format === 'basic' || !settings.format) && (
        <>
          <Divider style={{ margin: '8px 0' }} />
          <div className="tab-section" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <h4 className="tab-section-title" style={{ margin: '0 0 4px 0', fontSize: '1.1em', fontWeight: 'bold' }}>스타일</h4>
            
            <div className="tab-option-row" style={{ display: 'flex', flexDirection: 'column', gap: '6px', alignItems: 'stretch' }}>
              <span className="option-label" style={{ fontWeight: '500' }}>테마</span>
              <Select 
                value={settings.theme || 'basic'} 
                onChange={(val) => onSettingChange('theme', val)}
                style={{ width: '100%' }}
              >
                {Object.entries(themes).map(([key, theme]: [string, any]) => 
                  <Select.Option value={key} key={key}>{theme.name}</Select.Option>
                )}
              </Select>
            </div>

            <div className="tab-option-row" style={{ display: 'flex', flexDirection: 'column', gap: '6px', alignItems: 'stretch' }}>
              <span className="option-label" style={{ fontWeight: '500' }}>색상</span>
              <Select 
                value={settings.color || 'dark'} 
                onChange={(val) => onSettingChange('color', val)}
                style={{ width: '100%' }}
              >
                {Object.entries(colors).map(([key, color]: [string, any]) => 
                  <Select.Option value={key} key={key}>{color.name}</Select.Option>
                )}
              </Select>
            </div>

            <div className="tab-option-row" style={{ display: 'flex', flexDirection: 'column', gap: '6px', alignItems: 'stretch' }}>
              <span className="option-label" style={{ fontWeight: '500' }}>헤더 레이아웃</span>
              <Select 
                value={settings.headerLayout || 'default'} 
                onChange={(val) => onSettingChange('headerLayout', val)}
                style={{ width: '100%' }}
              >
                <Select.Option value="default">기본</Select.Option>
                <Select.Option value="compact">컴팩트</Select.Option>
                <Select.Option value="banner">배너</Select.Option>
                <Select.Option value="smart">스마트</Select.Option>
                <Select.Option value="cover">커버</Select.Option>
              </Select>
            </div>
          </div>

          {settings.theme === 'custom' && (
            <>
              <Divider style={{ margin: '8px 0' }} />
              <div className="tab-section" style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <h4 className="tab-section-title" style={{ margin: 0, fontSize: '1.1em', fontWeight: 'bold' }}>커스텀 CSS</h4>
                <Input.TextArea
                  value={settings.customCss || ''}
                  onChange={(e) => onSettingChange('customCss', e.target.value)}
                  placeholder="여기에 CSS 코드를 입력하세요..."
                  autoSize={{ minRows: 5, maxRows: 15 }}
                />
              </div>
            </>
          )}

          <Divider style={{ margin: '8px 0' }} />
          <div className="tab-section" style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            <h4 className="tab-section-title" style={{ margin: '0 0 12px 0', fontSize: '1.1em', fontWeight: 'bold' }}>표시 옵션</h4>
            <Toggle settingKey="showAvatar" label="아바타" description="프로필 이미지 표시" value={settings.showAvatar} />
            <Toggle settingKey="showBubble" label="말풍선" description="메시지 말풍선 스타일" value={settings.showBubble} />
            <Toggle settingKey="showHeader" label="헤더" description="상단 정보 표시" value={settings.showHeader} />
            
            {settings.showHeader !== false && (
              <div style={{ margin: '8px 0', paddingLeft: '16px', borderLeft: '2px solid var(--border-color)', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <Toggle settingKey="showHeaderIcon" label="헤더 아이콘" description="헤더 프로필 이미지 표시" value={settings.showHeaderIcon} />
                <div className="tab-option-row" style={{ display: 'flex', flexDirection: 'column', gap: '6px', alignItems: 'stretch' }}>
                  <span className="option-label" style={{ fontWeight: '500', fontSize: '0.95em' }}>헤더 태그</span>
                  <Input 
                    value={settings.headerTags || ''} 
                    onChange={(e) => onSettingChange('headerTags', e.target.value)} 
                    placeholder="쉼표로 태그 구분" 
                  />
                </div>
                {settings.headerLayout === 'banner' && (
                  <>
                    <div className="tab-option-row" style={{ display: 'flex', flexDirection: 'column', gap: '6px', alignItems: 'stretch' }}>
                      <span className="option-label" style={{ fontWeight: '500', fontSize: '0.95em' }}>배너 이미지 URL</span>
                      <Input 
                        value={settings.headerBannerUrl || ''} 
                        onChange={(e) => onSettingChange('headerBannerUrl', e.target.value)} 
                        placeholder="https://..." 
                      />
                    </div>
                    <Toggle settingKey="headerBannerBlur" label="블러 효과" description="배너 이미지에 블러 효과 적용" value={settings.headerBannerBlur} />
                    <div className="tab-option-row" style={{ display: 'flex', flexDirection: 'column', gap: '6px', alignItems: 'stretch' }}>
                      <span className="option-label" style={{ fontWeight: '500', fontSize: '0.95em' }}>이미지 정렬</span>
                      <div style={{ display: 'flex', gap: '16px', alignItems: 'center', width: '100%' }}>
                        <Slider 
                          min={0} 
                          max={100} 
                          value={settings.headerBannerAlign || 50} 
                          onChange={(val) => onSettingChange('headerBannerAlign', val)} 
                          style={{ flex: 1 }}
                        />
                        <InputNumber
                          min={0}
                          max={100}
                          value={settings.headerBannerAlign || 50}
                          onChange={(val) => onSettingChange('headerBannerAlign', val || 0)}
                          style={{ width: '70px' }}
                          formatter={(value) => `${value}%`}
                          parser={(value) => parseFloat(value?.replace('%', '') || '50')}
                        />
                      </div>
                    </div>
                  </>
                )}
              </div>
            )}
            
            <Toggle settingKey="showFooter" label="푸터" description="하단 정보 표시" value={settings.showFooter} />
            {settings.showFooter !== false && (
              <div style={{ margin: '8px 0', paddingLeft: '16px', borderLeft: '2px solid var(--border-color)', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <div className="tab-option-row" style={{ display: 'flex', flexDirection: 'column', gap: '6px', alignItems: 'stretch' }}>
                  <span className="option-label" style={{ fontWeight: '500', fontSize: '0.95em' }}>푸터 (왼쪽)</span>
                  <Input value={settings.footerLeft || ''} onChange={(e) => onSettingChange('footerLeft', e.target.value)} />
                </div>
                <div className="tab-option-row" style={{ display: 'flex', flexDirection: 'column', gap: '6px', alignItems: 'stretch' }}>
                  <span className="option-label" style={{ fontWeight: '500', fontSize: '0.95em' }}>푸터 (중앙)</span>
                  <Input value={settings.footerCenter || ''} onChange={(e) => onSettingChange('footerCenter', e.target.value)} />
                </div>
                <div className="tab-option-row" style={{ display: 'flex', flexDirection: 'column', gap: '6px', alignItems: 'stretch' }}>
                  <span className="option-label" style={{ fontWeight: '500', fontSize: '0.95em' }}>푸터 (오른쪽)</span>
                  <Input value={settings.footerRight || ''} onChange={(e) => onSettingChange('footerRight', e.target.value)} />
                </div>
              </div>
            )}
          </div>

          <Divider style={{ margin: '8px 0' }} />
          <div className="tab-section" style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <h4 className="tab-section-title" style={{ margin: 0, fontSize: '1.1em', fontWeight: 'bold' }}>이미지 크기</h4>
            <div style={{ display: 'flex', gap: '16px', alignItems: 'center', width: '100%' }}>
              <Slider 
                min={1} 
                max={100} 
                value={settings.imageScale || 100} 
                onChange={(val) => onSettingChange('imageScale', val)}
                style={{ flex: 1 }}
              />
              <InputNumber
                min={1}
                max={100}
                value={settings.imageScale || 100}
                onChange={(val) => onSettingChange('imageScale', val || 100)}
                style={{ width: '70px' }}
                formatter={(value) => `${value}%`}
                parser={(value) => parseFloat(value?.replace('%', '') || '100')}
              />
            </div>
          </div>
        </>
      )}

      {/* HTML 형식 설정 */}
      {settings.format === 'html' && (
        <>
          <Divider style={{ margin: '8px 0' }} />
          <div className="tab-section" style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            <h4 className="tab-section-title" style={{ margin: '0 0 12px 0', fontSize: '1.1em', fontWeight: 'bold' }}>HTML 옵션</h4>
            <Toggle settingKey="embedImages" label="이미지 내장" description="이미지를 Base64로 포함" value={settings.embedImages} />
            <Toggle settingKey="expandHover" label="호버 요소 펼치기" description="접힌 요소 자동 펼침" value={settings.expandHover} defaultOn={false} />
          </div>
        </>
      )}
    </div>
  );
};

export default ExportTab;
