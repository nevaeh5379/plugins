import React, { useState } from 'react';
import { Modal, Select, Input, Button, Tag, Divider } from 'antd';
import { PlusOutlined } from '@ant-design/icons';

interface PluginSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  globalSettings: any;
  onGlobalSettingChange: (key: string, value: any) => void;
}

const PluginSettingsModal: React.FC<PluginSettingsModalProps> = ({ 
  isOpen, 
  onClose, 
  globalSettings, 
  onGlobalSettingChange 
}) => {
  // 런타임 방어적 변수 추출
  const settings = globalSettings || {};
  const profileClasses = Array.isArray(settings.profileClasses) ? settings.profileClasses : [];
  const participantNameClasses = Array.isArray(settings.participantNameClasses) ? settings.participantNameClasses : [];
  const uiTheme = settings.uiTheme || 'dark';

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

  return (
    <Modal
      title="플러그인 설정"
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
      width={550}
    >
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
    </Modal>
  );
};

export default PluginSettingsModal;
