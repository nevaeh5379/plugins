import React from 'react';

interface MobileToolsTabProps {
  settings: any;
  onSettingChange: (key: string, value: any) => void;
  imageSizeWarning?: string;
}

const MobileToolsTab: React.FC<MobileToolsTabProps> = ({ settings, onSettingChange, imageSizeWarning }) => {
  return (
    <div className="mobile-settings-container">
      <div className="mobile-card">
        <div className="mobile-card-header">
          <span className="mobile-card-icon">👁️</span>
          <span className="mobile-card-title">미리보기</span>
        </div>
        <div className="mobile-card-content">
          <div className="mobile-field">
            <label className="mobile-field-label">스케일 배율</label>
            <input 
              type="number" 
              className="mobile-input-number" 
              value={settings.htmlScaleFactor !== undefined ? settings.htmlScaleFactor : 1.0} 
              onChange={(e) => onSettingChange('htmlScaleFactor', Number(e.target.value))} 
              min="0.5" 
              max="3.0" 
              step="0.1" 
            />
          </div>
          <div className="mobile-field">
            <label className="mobile-field-label">스케일 모드</label>
            <select 
              className="mobile-select" 
              value={settings.htmlScaleMode || 'font'} 
              onChange={(e) => onSettingChange('htmlScaleMode', e.target.value)}
            >
              <option value="font">글자만 스케일</option>
              <option value="full">HTML 전체 스케일</option>
            </select>
          </div>
          <div className="mobile-field">
            <label className="mobile-field-label">너비</label>
            <input 
              type="number" 
              className="mobile-input-number" 
              value={settings.previewWidth || 800} 
              onChange={(e) => onSettingChange('previewWidth', Number(e.target.value))} 
              min="320" 
              max="1920" 
              step="10" 
            />
          </div>
        </div>
      </div>

      <div className="mobile-card">
        <div className="mobile-card-header">
          <span className="mobile-card-icon">📷</span>
          <span className="mobile-card-title">이미지 내보내기</span>
        </div>
        {imageSizeWarning && (
          <div style={{ color: 'var(--text-warning)', padding: '12px 16px', fontSize: '0.9em', background: 'rgba(224, 175, 104, 0.1)' }}>
            {imageSizeWarning}
          </div>
        )}
        <div className="mobile-card-content">
          <div className="mobile-field">
            <label className="mobile-field-label">해상도</label>
            <select 
              className="mobile-select" 
              value={settings.imageResolution || 1} 
              onChange={(e) => onSettingChange('imageResolution', e.target.value)}
            >
              <option value="1">1x</option>
              <option value="2">2x</option>
              <option value="3">3x</option>
            </select>
          </div>
          <div className="mobile-field">
            <label className="mobile-field-label">포맷</label>
            <select 
              className="mobile-select" 
              value={settings.imageFormat || 'png'} 
              onChange={(e) => onSettingChange('imageFormat', e.target.value)}
            >
              <option value="png">PNG</option>
              <option value="jpeg">JPEG</option>
              <option value="webp">WebP</option>
            </select>
          </div>
        </div>
      </div>
    </div>
  );
};

export default MobileToolsTab;
