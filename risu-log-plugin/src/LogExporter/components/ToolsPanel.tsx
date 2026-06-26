import React, { useState } from 'react';

interface ToolsPanelProps {
  settings: any;
  onSettingChange: (key: string, value: any) => void;
}

const ToolsPanel: React.FC<ToolsPanelProps> = ({ settings, onSettingChange }) => {
    const [collapsedSections, setCollapsedSections] = useState<Set<string>>(new Set(['image-export']));

    const toggleSection = (sectionId: string) => {
        setCollapsedSections(prev => {
            const newSet = new Set(prev);
            if (newSet.has(sectionId)) {
                newSet.delete(sectionId);
            } else {
                newSet.add(sectionId);
            }
            return newSet;
        });
    };

    const Toggle: React.FC<{ settingKey: string, label: string, value: any, defaultOn?: boolean }> = ({ settingKey, label, value, defaultOn = true }) => {
        const isChecked = defaultOn ? value !== false : value === true;
        const handleChange = () => {
            onSettingChange(settingKey, !isChecked);
        };
        return (
            <div className="desktop-option-row">
                <span className="desktop-option-label">{label}</span>
                <div className={`desktop-toggle ${isChecked ? 'active' : ''}`} onClick={handleChange}>
                    <input type="checkbox" checked={isChecked} style={{display: 'none'}} readOnly />
                </div>
            </div>
        );
    };

  return (
    <>
        <div className={`desktop-section ${collapsedSections.has('preview-options') ? 'collapsed' : ''}`}>
            <div className="desktop-section-header" onClick={() => toggleSection('preview-options')}>
                <span className="desktop-section-icon">👁️</span>
                <span className="desktop-section-title">미리보기 옵션</span>
                <span className="desktop-section-collapse-icon">▼</span>
            </div>
            <div className="desktop-section-body">
                <div className="desktop-option-row">
                    <span className="desktop-option-label">스케일 배율</span>
                    <input type="number" className="desktop-input" data-setting-key="htmlScaleFactor" value={settings.htmlScaleFactor !== undefined ? settings.htmlScaleFactor : 1.0} onChange={(e) => onSettingChange('htmlScaleFactor', Number(e.target.value))} min="0.5" max="3.0" step="0.1" style={{width: '80px'}} />
                </div>
                <div className="desktop-option-row">
                    <span className="desktop-option-label">스케일 모드</span>
                    <select className="desktop-select" data-setting-key="htmlScaleMode" value={settings.htmlScaleMode || 'font'} onChange={(e) => onSettingChange('htmlScaleMode', e.target.value)}>
                        <option value="font">글자만 스케일</option>
                        <option value="full">HTML 전체 스케일</option>
                    </select>
                </div>
                <div className="desktop-option-row">
                    <span className="desktop-option-label">너비 (px)</span>
                    <input type="number" className="desktop-input" data-setting-key="previewWidth" value={settings.previewWidth || 800} onChange={(e) => onSettingChange('previewWidth', e.target.value)} min="320" max="1920" step="10" style={{width: '90px'}} />
                </div>
            </div>
        </div>

        <div className={`desktop-section ${collapsedSections.has('image-export') ? 'collapsed' : ''}`}>
            <div className="desktop-section-header" onClick={() => toggleSection('image-export')}>
                <span className="desktop-section-icon">📷</span>
                <span className="desktop-section-title">이미지 내보내기</span>
                <span className="desktop-section-collapse-icon">▼</span>
            </div>
            <div className="desktop-section-body">
                <div className="desktop-option-row">
                                    <span className="desktop-option-label">해상도</span>
                                    <select className="desktop-select" data-setting-key="imageResolution" value={settings.imageResolution || 1} onChange={(e) => onSettingChange('imageResolution', e.target.value === 'auto' ? 'auto' : Number(e.target.value))}>
                                        <option value="auto">자동</option>
                                        <option value="1">1x</option>
                                                            <option value="2">2x</option>
                                                            <option value="3">3x</option>
                                                            <option value="4">4x</option>
                                                            <option value="8">8x</option>
                                                            <option value="16">16x</option>
                                                        </select>                </div>
                <div className="desktop-option-row">
                    <span className="desktop-option-label">라이브러리</span>
                    <select className="desktop-select" data-setting-key="imageLibrary" value={settings.imageLibrary || 'html-to-image'} onChange={(e) => onSettingChange('imageLibrary', e.target.value)}>
                        <option value="html-to-image">html-to-image</option>
                        <option value="snapdom">snapdom</option>
                        <option value="dom-to-image">dom-to-image-more</option>
                    </select>
                </div>
                <div className="desktop-option-row">
                    <span className="desktop-option-label">포맷</span>
                    <select className="desktop-select" data-setting-key="imageFormat" value={settings.imageFormat || 'png'} onChange={(e) => onSettingChange('imageFormat', e.target.value)}>
                        <option value="png">PNG</option>
                        <option value="jpeg">JPG</option>
                        <option value="webp">WebP</option>
                    </select>
                </div>
                <Toggle settingKey="splitImage" label="긴 이미지 분할" value={settings.splitImage} defaultOn={false} />
                {settings.splitImage && (
                    <div className="desktop-option-row">
                        <label htmlFor="max-height-input" className="desktop-option-label">최대 높이 (px)</label>
                        <input id="max-height-input" type="number" className="desktop-input" value={settings.maxImageHeight || 10000} onChange={(e) => onSettingChange('maxImageHeight', parseInt(e.target.value, 10))} min="1000" max="50000" step="1000" style={{width: '100px'}} />
                    </div>
                )}
                <Toggle settingKey="rawHtmlView" label="Raw HTML 보기" value={settings.rawHtmlView} defaultOn={false} />
                <Toggle settingKey="isEditable" label="✍️ 로그 편집 활성화" value={settings.isEditable} defaultOn={false} />
            </div>
        </div>
    </>
  );
};

export default ToolsPanel;
