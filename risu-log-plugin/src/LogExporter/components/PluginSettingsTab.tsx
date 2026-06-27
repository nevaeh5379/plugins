/* eslint-disable @typescript-eslint/no-explicit-any */
import React, { useState } from 'react';

interface PluginSettingsTabProps {
  globalSettings: any;
  onGlobalSettingChange: (key: string, value: any) => void;
}

const PluginSettingsTab: React.FC<PluginSettingsTabProps> = ({
  globalSettings,
  onGlobalSettingChange
}) => {
  const [newProfileClass, setNewProfileClass] = useState('');
  const [newParticipantNameClass, setNewParticipantNameClass] = useState('');

  const settings = globalSettings || {};
  const profileClasses = Array.isArray(settings.profileClasses) ? settings.profileClasses : [];
  const participantNameClasses = Array.isArray(settings.participantNameClasses) ? settings.participantNameClasses : [];
  const uiTheme = settings.uiTheme || 'dark';

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
    <div className="tab-content" style={{ display: 'flex', flexDirection: 'column', gap: '20px', height: '100%', overflowY: 'auto', padding: '20px' }}>
      <div className="tab-section" style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
        <h4 className="tab-section-title" style={{ margin: 0, fontSize: '1.1em', fontWeight: 'bold' }}>UI 테마</h4>
        <div className="tab-option-row" style={{ display: 'flex', flexDirection: 'column', gap: '6px', alignItems: 'stretch' }}>
          <span className="option-label" style={{ fontWeight: '500' }}>모달 테마</span>
          <select 
            value={uiTheme} 
            onChange={(e) => onGlobalSettingChange('uiTheme', e.target.value)}
            style={{ 
              width: '100%', 
              height: '32px', 
              padding: '4px 11px',
              backgroundColor: 'var(--bg-secondary)', 
              color: 'var(--text-primary)',
              border: '1px solid var(--border-color)',
              borderRadius: '6px',
              outline: 'none',
              cursor: 'pointer'
            }}
          >
            <option value="dark" style={{ backgroundColor: 'var(--bg-tertiary)' }}>다크 모던</option>
            <option value="classic" style={{ backgroundColor: 'var(--bg-tertiary)' }}>클래식 다크</option>
            <option value="light" style={{ backgroundColor: 'var(--bg-tertiary)' }}>라이트</option>
          </select>
        </div>
      </div>

      <div style={{ borderTop: '1px solid var(--border-color)', margin: '8px 0' }} />

      <div className="tab-section" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
        <h4 className="tab-section-title" style={{ margin: 0, fontSize: '1.1em', fontWeight: 'bold' }}>커스텀 선택자</h4>
        
        <div className="tab-option-row" style={{ display: 'flex', flexDirection: 'column', gap: '6px', alignItems: 'stretch' }}>
          <span className="option-label" style={{ fontWeight: '500' }}>프로필 이미지 클래스</span>
          <span className="option-description" style={{ fontSize: '0.85em', color: 'var(--text-secondary)' }}>프로필 이미지를 찾기 위한 CSS 클래스를 추가하세요</span>
          <div style={{ display: 'flex', gap: '8px' }}>
            <input 
              value={newProfileClass} 
              onChange={(e) => setNewProfileClass(e.target.value)}
              placeholder="예: .avatar, .profile-img"
              onKeyDown={(e) => e.key === 'Enter' && handleAddProfileClass()}
              style={{ 
                flex: 1,
                height: '32px',
                padding: '4px 11px',
                backgroundColor: 'var(--bg-secondary)',
                color: 'var(--text-primary)',
                border: '1px solid var(--border-color)',
                borderRadius: '6px',
                outline: 'none'
              }}
            />
            <button 
              onClick={handleAddProfileClass}
              style={{
                height: '32px',
                padding: '0 15px',
                backgroundColor: 'var(--accent-primary, #61afef)',
                color: '#fff',
                border: 'none',
                borderRadius: '6px',
                cursor: 'pointer',
                fontWeight: '500'
              }}
            >
              추가
            </button>
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginTop: '8px' }}>
            {profileClasses.map((cls: string) => (
              <span 
                key={cls} 
                style={{ 
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '4px',
                  fontFamily: 'monospace',
                  padding: '2px 8px',
                  backgroundColor: 'var(--bg-secondary)',
                  border: '1px solid var(--border-color)',
                  borderRadius: '4px',
                  fontSize: '0.85em',
                  color: 'var(--text-primary)'
                }}
              >
                {cls}
                <span 
                  onClick={() => handleRemoveProfileClass(cls)}
                  style={{ cursor: 'pointer', fontWeight: 'bold', color: 'var(--text-secondary)', marginLeft: '4px' }}
                >
                  ×
                </span>
              </span>
            ))}
          </div>
        </div>

        <div className="tab-option-row" style={{ display: 'flex', flexDirection: 'column', gap: '6px', alignItems: 'stretch' }}>
          <span className="option-label" style={{ fontWeight: '500' }}>참가자 이름 클래스</span>
          <span className="option-description" style={{ fontSize: '0.85em', color: 'var(--text-secondary)' }}>참가자 이름을 찾기 위한 CSS 클래스를 추가하세요</span>
          <div style={{ display: 'flex', gap: '8px' }}>
            <input 
              value={newParticipantNameClass} 
              onChange={(e) => setNewParticipantNameClass(e.target.value)}
              placeholder="예: .username, .name"
              onKeyDown={(e) => e.key === 'Enter' && handleAddParticipantNameClass()}
              style={{ 
                flex: 1,
                height: '32px',
                padding: '4px 11px',
                backgroundColor: 'var(--bg-secondary)',
                color: 'var(--text-primary)',
                border: '1px solid var(--border-color)',
                borderRadius: '6px',
                outline: 'none'
              }}
            />
            <button 
              onClick={handleAddParticipantNameClass}
              style={{
                height: '32px',
                padding: '0 15px',
                backgroundColor: 'var(--accent-primary, #61afef)',
                color: '#fff',
                border: 'none',
                borderRadius: '6px',
                cursor: 'pointer',
                fontWeight: '500'
              }}
            >
              추가
            </button>
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginTop: '8px' }}>
            {participantNameClasses.map((cls: string) => (
              <span 
                key={cls} 
                style={{ 
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '4px',
                  fontFamily: 'monospace',
                  padding: '2px 8px',
                  backgroundColor: 'var(--bg-secondary)',
                  border: '1px solid var(--border-color)',
                  borderRadius: '4px',
                  fontSize: '0.85em',
                  color: 'var(--text-primary)'
                }}
              >
                {cls}
                <span 
                  onClick={() => handleRemoveParticipantNameClass(cls)}
                  style={{ cursor: 'pointer', fontWeight: 'bold', color: 'var(--text-secondary)', marginLeft: '4px' }}
                >
                  ×
                </span>
              </span>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default PluginSettingsTab;
