/* eslint-disable @typescript-eslint/no-explicit-any */
import React, { useState } from 'react';
import { Modal, Select, Input, Button, Tag, Divider, Tabs } from 'antd';
import { PlusOutlined } from '@ant-design/icons';
import MobileSettingsPanel from './MobileSettingsPanel';
import MobileToolsPanel from './MobileToolsPanel';

interface PluginSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  globalSettings: any;
  onGlobalSettingChange: (key: string, value: any) => void;
  // Mobile integration props
  isMobile?: boolean;
  settings?: any;
  onSettingChange?: (key: string, value: any) => void;
  themes?: any;
  colors?: any;
  participants?: Set<string>;
  uiClasses?: any[];
  imageSizeWarning?: string | null;
}

const PluginSettingsModal: React.FC<PluginSettingsModalProps> = ({ 
  isOpen, 
  onClose, 
  globalSettings, 
  onGlobalSettingChange,
  isMobile,
  settings,
  onSettingChange,
  themes,
  colors,
  participants,
  uiClasses,
  imageSizeWarning,
}) => {
  const settingsObj = globalSettings || {};
  const profileClasses = Array.isArray(settingsObj.profileClasses) ? settingsObj.profileClasses : [];
  const participantNameClasses = Array.isArray(settingsObj.participantNameClasses) ? settingsObj.participantNameClasses : [];
  const uiTheme = settingsObj.uiTheme || 'dark';

  const [newProfileClass, setNewProfileClass] = useState('');
  const [newParticipantNameClass, setNewParticipantNameClass] = useState('');

  const handleAddProfileClass = () => {
    if (newProfileClass && !profileClasses.includes(newProfileClass)) {
      const newClasses = [...profileClasses, newProfileClass];
      onGlobalSettingChange('profileClasses', newClasses);
      setNewProfileClass('');
    }
  };

  const handleRemoveProfileClass = (cls: string) => {
    const newClasses = profileClasses.filter((c: string) => c !== cls);
    onGlobalSettingChange('profileClasses', newClasses);
  };

  const handleAddParticipantNameClass = () => {
    if (newParticipantNameClass && !participantNameClasses.includes(newParticipantNameClass)) {
      const newClasses = [...participantNameClasses, newParticipantNameClass];
      onGlobalSettingChange('participantNameClasses', newClasses);
      setNewParticipantNameClass('');
    }
  };

  const handleRemoveParticipantNameClass = (cls: string) => {
    const newClasses = participantNameClasses.filter((c: string) => c !== cls);
    onGlobalSettingChange('participantNameClasses', newClasses);
  };

  const pluginSettingsContent = () => (
    <div className="plugin-settings-content" style={{ display: 'flex', flexDirection: 'column', gap: '16px', padding: '12px 0' }}>
      {/* UI 테마 설정 */}
      <div className="settings-section" style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
        <span style={{ fontWeight: 'bold', fontSize: '1.05em' }}>UI 테마</span>
        <div className="setting-item" style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <span style={{ minWidth: '80px' }}>모달 테마</span>
          <Select 
            value={uiTheme} 
            onChange={(val) => onGlobalSettingChange('uiTheme', val)}
            style={{ flex: 1 }}
            options={[
              { value: 'dark', label: '다크 모던' },
              { value: 'classic', label: '클래식 다크' },
              { value: 'light', label: '라이트' }
            ]}
          />
        </div>
      </div>

      <Divider style={{ margin: '12px 0' }} />

      {/* 커스텀 선택자 */}
      <div className="settings-section" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
        <span style={{ fontWeight: 'bold', fontSize: '1.05em' }}>커스텀 선택자</span>
        
        <div className="custom-selector-group" style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <span style={{ fontWeight: '500' }}>프로필 이미지 클래스</span>
          <span className="setting-description" style={{ fontSize: '0.85em', color: 'var(--text-secondary)' }}>프로필 이미지를 찾기 위한 CSS 클래스를 추가하세요</span>
          <div style={{ display: 'flex', gap: '8px' }}>
            <Input 
              value={newProfileClass} 
              onChange={(e) => setNewProfileClass(e.target.value)}
              placeholder="예: .avatar, .profile-img"
              onKeyDown={(e) => e.key === 'Enter' && handleAddProfileClass()}
              style={{ flex: 1 }}
            />
            <Button icon={<PlusOutlined />} onClick={handleAddProfileClass}>추가</Button>
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginTop: '4px' }}>
            {profileClasses.map((cls: string) => (
              <Tag key={cls} closable onClose={() => handleRemoveProfileClass(cls)} style={{ fontFamily: 'monospace' }}>
                {cls}
              </Tag>
            ))}
          </div>
        </div>

        <div className="custom-selector-group" style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <span style={{ fontWeight: '500' }}>참가자 이름 클래스</span>
          <span className="setting-description" style={{ fontSize: '0.85em', color: 'var(--text-secondary)' }}>참가자 이름을 찾기 위한 CSS 클래스를 추가하세요</span>
          <div style={{ display: 'flex', gap: '8px' }}>
            <Input 
              value={newParticipantNameClass} 
              onChange={(e) => setNewParticipantNameClass(e.target.value)}
              placeholder="예: .username, .name"
              onKeyDown={(e) => e.key === 'Enter' && handleAddParticipantNameClass()}
              style={{ flex: 1 }}
            />
            <Button icon={<PlusOutlined />} onClick={handleAddParticipantNameClass}>추가</Button>
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginTop: '4px' }}>
            {participantNameClasses.map((cls: string) => (
              <Tag key={cls} closable onClose={() => handleRemoveParticipantNameClass(cls)} style={{ fontFamily: 'monospace' }}>
                {cls}
              </Tag>
            ))}
          </div>
        </div>
      </div>
    </div>
  );

  const renderContent = () => {
    if (isMobile) {
      return (
        <Tabs
          defaultActiveKey="settings"
          centered
          items={[
            {
              key: 'settings',
              label: '기본 설정',
              children: (
                <div style={{ maxHeight: '60vh', overflowY: 'auto', padding: '12px 4px' }}>
                  <MobileSettingsPanel 
                    settings={settings} 
                    onSettingChange={onSettingChange!} 
                    themes={themes} 
                    colors={colors} 
                    participants={participants || new Set()} 
                    globalSettings={globalSettings} 
                    onGlobalSettingChange={onGlobalSettingChange} 
                    uiClasses={uiClasses || []} 
                  />
                </div>
              )
            },
            {
              key: 'tools',
              label: '도구',
              children: (
                <div style={{ maxHeight: '60vh', overflowY: 'auto', padding: '12px 4px' }}>
                  <MobileToolsPanel 
                    settings={settings} 
                    onSettingChange={onSettingChange!} 
                    imageSizeWarning={imageSizeWarning || undefined} 
                  />
                </div>
              )
            },
            {
              key: 'global',
              label: '플러그인 설정',
              children: (
                <div style={{ maxHeight: '60vh', overflowY: 'auto', padding: '12px 4px' }}>
                  {pluginSettingsContent()}
                </div>
              )
            }
          ]}
        />
      );
    }
    return pluginSettingsContent();
  };

  return (
    <Modal
      title={isMobile ? "설정 및 도구" : "플러그인 설정"}
      open={isOpen}
      onCancel={onClose}
      getContainer={() => document.getElementById('log-exporter-react-modal-root') || document.body}
      transitionName=""
      maskTransitionName=""
      footer={[
        <Button key="close" onClick={onClose}>
          닫기
        </Button>
      ]}
      width={isMobile ? '95%' : 550}
    >
      {renderContent()}
    </Modal>
  );
};

export default PluginSettingsModal;
