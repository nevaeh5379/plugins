import React, { useState } from 'react';
import { useSettings, ThemeType, EditorType, ExplorerMode, CustomThemeColors } from '../lib/settingsContext';
import { VscClose } from 'react-icons/vsc';

interface SettingsModalProps {
  onClose: () => void;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({ onClose }) => {
  const { settings, updateSettings, updateCustomTheme } = useSettings();
  const [activeTab, setActiveTab] = useState<'editor' | 'theme'>('editor');

  const handleEditorChange = (key: 'desktopEditor' | 'mobileEditor', val: string) => {
    updateSettings({ [key]: val as EditorType });
  };

  const handleFontSizeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = parseInt(e.target.value, 10);
    if (!isNaN(val) && val >= 8 && val <= 36) {
      updateSettings({ fontSize: val });
    }
  };

  const handleThemeChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    updateSettings({ theme: e.target.value as ThemeType });
  };

  const handleColorChange = (key: keyof CustomThemeColors, val: string) => {
    updateCustomTheme({ [key]: val });
  };

  const colorLabels: Record<keyof CustomThemeColors, string> = {
    bgEditor: 'Editor Background',
    bgSidebar: 'Sidebar Background',
    bgTitlebar: 'Titlebar Background',
    bgStatusbar: 'Statusbar Background',
    bgTabActive: 'Active Tab Background',
    bgTabInactive: 'Inactive Tab Background',
    bgInput: 'Input Background',
    bgHover: 'Hover Background',
    bgSelected: 'Selected Background',
    fg: 'Text Color',
    fgBright: 'Bright Text',
    fgMuted: 'Muted Text',
    fgDim: 'Dim Text',
    accent: 'Accent Color',
    accentHover: 'Accent Hover',
    border: 'Border',
    borderStrong: 'Strong Border',
  };

  return (
    <div className="re-modal-overlay" onClick={onClose}>
      <div className="re-modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="re-modal-header">
          <h3>Settings</h3>
          <button className="re-btn re-btn-icon" onClick={onClose} title="Close">
            <VscClose />
          </button>
        </div>
        <div className="re-modal-tabs">
          <button
            className={`re-tab ${activeTab === 'editor' ? 'active' : ''}`}
            onClick={() => setActiveTab('editor')}
          >
            Editor
          </button>
          <button
            className={`re-tab ${activeTab === 'theme' ? 'active' : ''}`}
            onClick={() => setActiveTab('theme')}
          >
            Theme
          </button>
        </div>
        <div className="re-modal-body">
          {activeTab === 'editor' && (
            <div className="re-settings-section">
              <div className="re-setting-item">
                <label>Desktop Editor</label>
                <select
                  className="re-input"
                  value={settings.desktopEditor}
                  onChange={(e) => handleEditorChange('desktopEditor', e.target.value)}
                >
                  <option value="monaco">Monaco Editor</option>
                  <option value="codemirror">CodeMirror</option>
                  <option value="ace">Ace Editor</option>
                  <option value="simple">React Simple Code Editor</option>
                </select>
              </div>
              <div className="re-setting-item">
                <label>Mobile Editor</label>
                <select
                  className="re-input"
                  value={settings.mobileEditor}
                  onChange={(e) => handleEditorChange('mobileEditor', e.target.value)}
                >
                  <option value="monaco">Monaco Editor</option>
                  <option value="codemirror">CodeMirror (Default)</option>
                  <option value="ace">Ace Editor</option>
                  <option value="simple">React Simple Code Editor</option>
                </select>
                <div className="re-setting-hint">Used when screen width is less than 768px.</div>
              </div>
              <div className="re-setting-item">
                <label>Font Size</label>
                <input
                  type="number"
                  className="re-input"
                  value={settings.fontSize}
                  onChange={handleFontSizeChange}
                  min={8}
                  max={36}
                />
              </div>
              <div className="re-setting-item">
                <label>Explorer Mode (창 모드)</label>
                <select
                  className="re-input"
                  value={settings.explorerMode}
                  onChange={(e) => updateSettings({ explorerMode: e.target.value as ExplorerMode })}
                >
                  <option value="sidebar">사이드바 고정</option>
                  <option value="window">버튼으로 열기/닫기</option>
                </select>
                <div className="re-setting-hint">창 모드에서 파일 탐색기 표시 방식을 선택합니다.</div>
              </div>
            </div>
          )}
          {activeTab === 'theme' && (
            <div className="re-settings-section">
              <div className="re-setting-item">
                <label>Active Theme</label>
                <select className="re-input" value={settings.theme} onChange={handleThemeChange}>
                  <option value="risu-dark">Dark Theme</option>
                  <option value="risu-light">Light Theme</option>
                  <option value="custom">Custom Theme</option>
                </select>
              </div>
              {settings.theme === 'custom' && (
                <div className="re-custom-theme-grid">
                  {(Object.keys(settings.customTheme) as Array<keyof CustomThemeColors>).map((key) => (
                    <div className="re-setting-color-item" key={key}>
                      <label>{colorLabels[key]}</label>
                      <input
                        type="color"
                        value={settings.customTheme[key]}
                        onChange={(e) => handleColorChange(key, e.target.value)}
                      />
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
