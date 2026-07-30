/* eslint-disable @typescript-eslint/no-explicit-any */
import React, { useState } from 'react';
import { Select, Input, Button } from 'antd';
import { Palette, Sliders, Plus, X } from 'lucide-react';

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
    <div className="tab-content" style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
      {/* UI 테마 카드 */}
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
          <h4 style={{ margin: 0, fontSize: '13px', fontWeight: 600, color: 'var(--foreground)' }}>UI 테마</h4>
        </div>

        <div className="setting-field" style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
          <label style={{ fontSize: '12px', fontWeight: 500, color: 'var(--foreground)' }}>모달 테마</label>
          <Select
            value={uiTheme}
            onChange={(val) => onGlobalSettingChange('uiTheme', val)}
            style={{ width: '100%' }}
            options={[
              { value: 'dark', label: '다크 모던 (Zinc Slate)' },
              { value: 'classic', label: '클래식 다크' },
              { value: 'light', label: '라이트' },
            ]}
          />
        </div>
      </div>

      {/* 커스텀 선택자 카드 */}
      <div className="shadcn-card" style={{
        backgroundColor: 'var(--card)',
        border: '1px solid var(--border)',
        borderRadius: 'var(--radius)',
        padding: '14px 16px',
        display: 'flex',
        flexDirection: 'column',
        gap: '16px',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Sliders size={16} style={{ color: 'var(--foreground)' }} />
          <h4 style={{ margin: 0, fontSize: '13px', fontWeight: 600, color: 'var(--foreground)' }}>커스텀 선택자</h4>
        </div>

        {/* 프로필 이미지 클래스 */}
        <div className="setting-field" style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
          <label style={{ fontSize: '12px', fontWeight: 500, color: 'var(--foreground)' }}>프로필 이미지 클래스</label>
          <p style={{ margin: 0, fontSize: '11px', color: 'var(--muted-foreground)' }}>
            프로필 이미지를 탐색하기 위한 추가 CSS 선택자
          </p>
          <div style={{ display: 'flex', gap: '8px', marginTop: '2px' }}>
            <Input
              value={newProfileClass}
              onChange={(e) => setNewProfileClass(e.target.value)}
              placeholder="예: .avatar, .profile-img"
              onKeyDown={(e) => e.key === 'Enter' && handleAddProfileClass()}
              style={{ flex: 1 }}
            />
            <Button icon={<Plus size={14} />} onClick={handleAddProfileClass}>추가</Button>
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginTop: '6px' }}>
            {profileClasses.map((cls: string) => (
              <span
                key={cls}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '4px',
                  fontFamily: 'monospace',
                  fontSize: '11px',
                  padding: '2px 8px',
                  borderRadius: '4px',
                  backgroundColor: 'var(--muted)',
                  border: '1px solid var(--border)',
                  color: 'var(--foreground)',
                }}
              >
                {cls}
                <X
                  size={12}
                  style={{ cursor: 'pointer', opacity: 0.7 }}
                  onClick={() => handleRemoveProfileClass(cls)}
                />
              </span>
            ))}
          </div>
        </div>

        {/* 참가자 이름 클래스 */}
        <div className="setting-field" style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
          <label style={{ fontSize: '12px', fontWeight: 500, color: 'var(--foreground)' }}>참가자 이름 클래스</label>
          <p style={{ margin: 0, fontSize: '11px', color: 'var(--muted-foreground)' }}>
            참가자 이름을 탐색하기 위한 추가 CSS 선택자
          </p>
          <div style={{ display: 'flex', gap: '8px', marginTop: '2px' }}>
            <Input
              value={newParticipantNameClass}
              onChange={(e) => setNewParticipantNameClass(e.target.value)}
              placeholder="예: .username, .name"
              onKeyDown={(e) => e.key === 'Enter' && handleAddParticipantNameClass()}
              style={{ flex: 1 }}
            />
            <Button icon={<Plus size={14} />} onClick={handleAddParticipantNameClass}>추가</Button>
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginTop: '6px' }}>
            {participantNameClasses.map((cls: string) => (
              <span
                key={cls}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '4px',
                  fontFamily: 'monospace',
                  fontSize: '11px',
                  padding: '2px 8px',
                  borderRadius: '4px',
                  backgroundColor: 'var(--muted)',
                  border: '1px solid var(--border)',
                  color: 'var(--foreground)',
                }}
              >
                {cls}
                <X
                  size={12}
                  style={{ cursor: 'pointer', opacity: 0.7 }}
                  onClick={() => handleRemoveParticipantNameClass(cls)}
                />
              </span>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default PluginGlobalSettings;