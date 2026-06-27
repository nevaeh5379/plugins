/* eslint-disable @typescript-eslint/no-explicit-any */
import React, { useState } from 'react';
import { Select, Input, Button, Tag, Divider, Typography } from 'antd';
import { PlusOutlined } from '@ant-design/icons';

const { Title, Text } = Typography;

interface PluginGlobalSettingsProps {
  globalSettings: any;
  onGlobalSettingChange: (key: string, value: any) => void;
}

const PluginGlobalSettings: React.FC<PluginGlobalSettingsProps> = ({
  globalSettings,
  onGlobalSettingChange,
}) => {
  const settingsObj = globalSettings || {};
  const profileClasses = Array.isArray(settingsObj.profileClasses) ? settingsObj.profileClasses : [];
  const participantNameClasses = Array.isArray(settingsObj.participantNameClasses) ? settingsObj.participantNameClasses : [];
  const uiTheme = settingsObj.uiTheme || 'dark';

  const [newProfileClass, setNewProfileClass] = useState('');
  const [newParticipantNameClass, setNewParticipantNameClass] = useState('');

  const handleAddProfileClass = () => {
    if (newProfileClass && !profileClasses.includes(newProfileClass)) {
      onGlobalSettingChange('profileClasses', [...profileClasses, newProfileClass]);
      setNewProfileClass('');
    }
  };

  const handleRemoveProfileClass = (cls: string) => {
    onGlobalSettingChange('profileClasses', profileClasses.filter((c: string) => c !== cls));
  };

  const handleAddParticipantNameClass = () => {
    if (newParticipantNameClass && !participantNameClasses.includes(newParticipantNameClass)) {
      onGlobalSettingChange('participantNameClasses', [...participantNameClasses, newParticipantNameClass]);
      setNewParticipantNameClass('');
    }
  };

  const handleRemoveParticipantNameClass = (cls: string) => {
    onGlobalSettingChange('participantNameClasses', participantNameClasses.filter((c: string) => c !== cls));
  };

  return (
    <div className="tab-content">
      {/* UI 테마 */}
      <div className="tab-section">
        <Title level={5} className="tab-section-title">UI 테마</Title>
        <div className="setting-field">
          <Text className="setting-field-label">모달 테마</Text>
          <Select
            value={uiTheme}
            onChange={(val) => onGlobalSettingChange('uiTheme', val)}
            style={{ width: '100%' }}
            options={[
              { value: 'dark', label: '다크 모던' },
              { value: 'classic', label: '클래식 다크' },
              { value: 'light', label: '라이트' },
            ]}
          />
        </div>
      </div>

      <Divider />

      {/* 커스텀 선택자 */}
      <div className="tab-section">
        <Title level={5} className="tab-section-title">커스텀 선택자</Title>

        <div className="setting-field">
          <Text className="setting-field-label">프로필 이미지 클래스</Text>
          <Text type="secondary" style={{ fontSize: '0.85em' }}>프로필 이미지를 찾기 위한 CSS 클래스를 추가하세요</Text>
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

        <div className="setting-field">
          <Text className="setting-field-label">참가자 이름 클래스</Text>
          <Text type="secondary" style={{ fontSize: '0.85em' }}>참가자 이름을 찾기 위한 CSS 클래스를 추가하세요</Text>
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
};

export default PluginGlobalSettings;