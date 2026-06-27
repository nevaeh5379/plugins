/* eslint-disable @typescript-eslint/no-explicit-any */
import React, { useEffect } from 'react';
import { Select, Switch, InputNumber, Alert, Divider } from 'antd';

interface AdvancedTabProps {
  settings: any;
  onSettingChange: (key: string, value: any) => void;
  imageSizeWarning?: string;
}

const AdvancedTab: React.FC<AdvancedTabProps> = ({ settings, onSettingChange, imageSizeWarning }) => {

  const resolution = settings.imageResolution === 'auto' ? 1 : (Number(settings.imageResolution) || 1);
  const browserMaxHeight = 16384;
  const maxAllowedHeight = Math.floor(browserMaxHeight / resolution);

  useEffect(() => {
    if (settings.maxImageHeight > maxAllowedHeight) {
      onSettingChange('maxImageHeight', maxAllowedHeight);
    }
  }, [settings.imageResolution, settings.maxImageHeight, maxAllowedHeight, onSettingChange]);

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
      {/* 미리보기 */}
      <div className="tab-section" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
        <h4 className="tab-section-title" style={{ margin: 0, fontSize: '1.1em', fontWeight: 'bold' }}>미리보기</h4>
        
        <div className="tab-option-row" style={{ display: 'flex', flexDirection: 'column', gap: '6px', alignItems: 'stretch' }}>
          <span className="option-label" style={{ fontWeight: '500' }}>스케일 배율</span>
          <InputNumber 
            value={settings.htmlScaleFactor !== undefined ? settings.htmlScaleFactor : 1.0} 
            onChange={(val) => onSettingChange('htmlScaleFactor', val)} 
            min={0.5} 
            max={3.0}
            step={0.1}
            addonAfter="배"
            style={{ width: '100%' }}
          />
        </div>

        <div className="tab-option-row" style={{ display: 'flex', flexDirection: 'column', gap: '6px', alignItems: 'stretch' }}>
          <span className="option-label" style={{ fontWeight: '500' }}>스케일 모드</span>
          <Select 
            value={settings.htmlScaleMode || 'font'} 
            onChange={(val) => onSettingChange('htmlScaleMode', val)}
            style={{ width: '100%' }}
          >
            <option value="font">글자만 스케일</option>
            <option value="full">HTML 전체 스케일 (레이아웃 포함)</option>
          </Select>
        </div>

        <div className="tab-option-row" style={{ display: 'flex', flexDirection: 'column', gap: '6px', alignItems: 'stretch' }}>
          <span className="option-label" style={{ fontWeight: '500' }}>너비</span>
          <InputNumber 
            value={settings.previewWidth || 800} 
            onChange={(val) => onSettingChange('previewWidth', val)} 
            min={320} 
            max={1920} 
            step={10}
            addonAfter="px"
            style={{ width: '100%' }}
          />
        </div>
      </div>

      <Divider style={{ margin: '8px 0' }} />

      {/* 이미지 내보내기 */}
      <div className="tab-section" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
        <h4 className="tab-section-title" style={{ margin: 0, fontSize: '1.1em', fontWeight: 'bold' }}>이미지 내보내기</h4>
        
        {imageSizeWarning && (
          <Alert 
            message={imageSizeWarning} 
            type="warning" 
            showIcon 
            style={{ fontSize: '0.9em' }}
          />
        )}

        <div className="tab-option-row" style={{ display: 'flex', flexDirection: 'column', gap: '6px', alignItems: 'stretch' }}>
          <span className="option-label" style={{ fontWeight: '500' }}>해상도</span>
          <Select 
            value={settings.imageResolution || '1'} 
            onChange={(val) => onSettingChange('imageResolution', val)}
            style={{ width: '100%' }}
          >
            <option value="auto">자동</option>
            <option value="1">1x</option>
            <option value="2">2x</option>
            <option value="3">3x</option>
            <option value="4">4x</option>
            <option value="8">8x</option>
            <option value="16">16x</option>
            <option value="32">32x</option>
            <option value="64">64x</option>
            <option value="128">128x</option>
          </Select>
        </div>

        <div className="tab-option-row" style={{ display: 'flex', flexDirection: 'column', gap: '6px', alignItems: 'stretch' }}>
          <span className="option-label" style={{ fontWeight: '500' }}>라이브러리</span>
          <Select 
            value={settings.imageLibrary || 'html-to-image'} 
            onChange={(val) => onSettingChange('imageLibrary', val)}
            style={{ width: '100%' }}
          >
            <Select.Option value="html-to-image">html-to-image (권장)</Select.Option>
            <Select.Option value="snapdom">snapdom</Select.Option>
            <Select.Option value="dom-to-image">dom-to-image-more</Select.Option>
          </Select>
        </div>

        <div className="tab-option-row" style={{ display: 'flex', flexDirection: 'column', gap: '6px', alignItems: 'stretch' }}>
          <span className="option-label" style={{ fontWeight: '500' }}>포맷</span>
          <Select 
            value={settings.imageFormat || 'png'} 
            onChange={(val) => onSettingChange('imageFormat', val)}
            style={{ width: '100%' }}
          >
            <Select.Option value="png">PNG</Select.Option>
            <Select.Option value="jpeg">JPEG</Select.Option>
            <Select.Option value="webp">WebP</Select.Option>
          </Select>
        </div>
        
        <div className="tab-option-row" style={{ display: 'flex', flexDirection: 'column', gap: '6px', alignItems: 'stretch' }}>
          <span className="option-label" style={{ fontWeight: '500' }}>이미지 분할</span>
          <Select 
            value={settings.splitImage || 'none'} 
            onChange={(val) => onSettingChange('splitImage', val)}
            style={{ width: '100%' }}
          >
            <Select.Option value="none">분할 안함</Select.Option>
            <Select.Option value="chunk">청크 단위 (1개 파일로 병합)</Select.Option>
            <Select.Option value="message">메시지 단위 (여러 파일)</Select.Option>
          </Select>
        </div>
        
        {settings.splitImage && settings.splitImage !== 'none' && (
          <div className="tab-option-row" style={{ display: 'flex', flexDirection: 'column', gap: '6px', paddingLeft: '16px', borderLeft: '2px solid var(--border-color)', alignItems: 'stretch' }}>
            <span className="option-label" style={{ fontWeight: '500' }}>최대 높이</span>
            <InputNumber 
              value={settings.maxImageHeight || 10000} 
              onChange={(val) => onSettingChange('maxImageHeight', val || 10000)} 
              min={1000} 
              max={maxAllowedHeight} 
              step={1000} 
              addonAfter="px"
              style={{ width: '100%' }}
            />
          </div>
        )}
      </div>

      <Divider style={{ margin: '8px 0' }} />

      {/* 개발자 도구 */}
      <div className="tab-section" style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
        <h4 className="tab-section-title" style={{ margin: '0 0 12px 0', fontSize: '1.1em', fontWeight: 'bold' }}>개발자 도구</h4>
        <Toggle 
          settingKey="rawHtmlView" 
          label="Raw HTML 보기" 
          description="생성된 HTML 코드 직접 보기"
          value={settings.rawHtmlView} 
          defaultOn={false} 
        />
        <Toggle 
          settingKey="isEditable" 
          label="로그 편집 모드" 
          description="메시지 직접 수정 및 삭제"
          value={settings.isEditable} 
          defaultOn={false} 
        />
        <Toggle 
          settingKey="disableAnimations" 
          label="CSS 애니메이션 제외" 
          description="미리보기 및 저장 시 애니메이션 제거 (권장)"
          value={settings.disableAnimations} 
          defaultOn={true} 
        />
      </div>
    </div>
  );
};

export default AdvancedTab;
