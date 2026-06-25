import React, { useEffect } from 'react';
import { Collapse, Select, Segmented, Switch, InputNumber, Alert } from 'antd';

interface MobileToolsPanelProps {
  settings: any;
  onSettingChange: (key: string, value: any) => void;
  imageSizeWarning?: string;
}

const MobileToolsPanel: React.FC<MobileToolsPanelProps> = ({ settings, onSettingChange, imageSizeWarning }) => {
  
  const resolution = settings.imageResolution === 'auto' ? 1 : (Number(settings.imageResolution) || 1);
  const browserMaxHeight = 16384;
  const maxAllowedHeight = Math.floor(browserMaxHeight / resolution);

  useEffect(() => {
    if (settings.maxImageHeight > maxAllowedHeight) {
      onSettingChange('maxImageHeight', maxAllowedHeight);
    }
  }, [settings.imageResolution, settings.maxImageHeight, maxAllowedHeight, onSettingChange]);

  const collapseItems = [
    {
      key: 'preview-options',
      label: '미리보기 옵션',
      children: (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            <span>글자 크기 (px)</span>
            <InputNumber 
              value={settings.previewFontSize || 16} 
              onChange={(val) => onSettingChange('previewFontSize', val)} 
              min={10} 
              max={32}
              style={{ width: '100%' }}
            />
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            <span>너비 (px)</span>
            <InputNumber 
              value={settings.previewWidth || 800} 
              onChange={(val) => onSettingChange('previewWidth', val)} 
              min={320} 
              max={1920} 
              step={10}
              style={{ width: '100%' }}
            />
          </div>
        </div>
      )
    },
    {
      key: 'image-export',
      label: '이미지 내보내기',
      children: (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {imageSizeWarning && (
            <Alert 
              message={imageSizeWarning} 
              type="warning" 
              showIcon 
              style={{ fontSize: '0.85em', marginBottom: '4px' }}
            />
          )}
          
          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            <span>해상도</span>
            <Segmented 
              value={settings.imageResolution || '1'}
              onChange={(val) => onSettingChange('imageResolution', val)}
              options={[
                { label: '1x', value: '1' },
                { label: '2x', value: '2' },
                { label: '3x', value: '3' },
              ]}
              block
            />
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            <span>라이브러리</span>
            <Select 
              value={settings.imageLibrary || 'html-to-image'} 
              onChange={(val) => onSettingChange('imageLibrary', val)}
              style={{ width: '100%' }}
            >
              <Select.Option value="html-to-image">html-to-image</Select.Option>
              <Select.Option value="snapdom">snapdom</Select.Option>
              <Select.Option value="dom-to-image">dom-to-image-more</Select.Option>
            </Select>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            <span>이미지 분할</span>
            <Select 
              value={settings.splitImage || 'none'} 
              onChange={(val) => onSettingChange('splitImage', val)}
              style={{ width: '100%' }}
            >
              <Select.Option value="none">분할 안함</Select.Option>
              <Select.Option value="chunk">청크 단위 (병합)</Select.Option>
              <Select.Option value="message">메시지 단위 (여러 파일)</Select.Option>
            </Select>
          </div>
            
          {settings.splitImage && settings.splitImage !== 'none' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', paddingLeft: '12px', borderLeft: '2px solid var(--border-color)' }}>
              <span>최대 높이 (px)</span>
              <InputNumber 
                value={settings.maxImageHeight || 10000} 
                onChange={(val) => onSettingChange('maxImageHeight', val || 10000)} 
                min={1000} 
                max={maxAllowedHeight} 
                step={1000}
                style={{ width: '100%' }}
              />
            </div>
          )}

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '6px' }}>
            <span>Raw HTML 보기</span>
            <Switch checked={settings.rawHtmlView === true} onChange={(val) => onSettingChange('rawHtmlView', val)} />
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span>로그 편집</span>
            <Switch checked={settings.isEditable === true} onChange={(val) => onSettingChange('isEditable', val)} />
          </div>
        </div>
      )
    }
  ];

  return (
    <div className="mobile-settings-container" style={{ padding: '8px 4px' }}>
      <Collapse 
        items={collapseItems} 
        defaultActiveKey={['preview-options', 'image-export']} 
        expandIconPosition="end"
        style={{ border: 'none', background: 'transparent' }}
      />
    </div>
  );
};

export default MobileToolsPanel;
