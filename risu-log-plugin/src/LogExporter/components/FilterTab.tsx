/* eslint-disable @typescript-eslint/no-explicit-any */
import React from 'react';
import type { UIClassInfo } from '../utils/domUtils';
import { Users, EyeOff, Check } from 'lucide-react';
import { Checkbox } from 'antd';

interface FilterTabProps {
  settings: any;
  onSettingChange: (key: string, value: any) => void;
  participants: Set<string>;
  globalSettings: any;
  onGlobalSettingChange: (key: string, value: any) => void;
  uiClasses: UIClassInfo[];
}

const FilterTab: React.FC<FilterTabProps> = ({
  settings,
  onSettingChange,
  participants,
  globalSettings,
  onGlobalSettingChange,
  uiClasses
}) => {

  const handleCustomFilterChange = (className: string, isChecked: boolean) => {
    const newFilters = { ...(settings.customFilters || {}), [className]: isChecked };
    onSettingChange('customFilters', newFilters);
  };

  const handleParticipantToggle = (participant: string) => {
    const currentList = globalSettings.filteredParticipants || [];
    const isHidden = currentList.includes(participant);
    const newList = isHidden
      ? currentList.filter((p: string) => p !== participant)
      : [...currentList, participant];
    onGlobalSettingChange('filteredParticipants', newList);
  };

  const isParticipantVisible = (participant: string) => {
    return !globalSettings.filteredParticipants?.includes(participant);
  };

  return (
    <div className="tab-content" style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
      {/* 참가자 필터 카드 */}
      <div className="shadcn-card" style={{
        backgroundColor: 'var(--card)',
        border: '1px solid var(--border)',
        borderRadius: 'var(--radius)',
        padding: '14px 16px',
        display: 'flex',
        flexDirection: 'column',
        gap: '12px',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Users size={16} style={{ color: 'var(--foreground)' }} />
          <h4 style={{ margin: 0, fontSize: '13px', fontWeight: 600, color: 'var(--foreground)' }}>참가자 필터</h4>
        </div>
        <p style={{ margin: 0, fontSize: '12px', color: 'var(--muted-foreground)', lineHeight: 1.4 }}>
          표시할 참가자를 선택하세요 (선택된 참가자만 로그에 표시됩니다)
        </p>

        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginTop: '4px' }}>
          {Array.from(participants).map(p => {
            const visible = isParticipantVisible(p);
            return (
              <button
                key={p}
                type="button"
                onClick={() => handleParticipantToggle(p)}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '5px',
                  padding: '5px 10px',
                  fontSize: '12px',
                  fontWeight: 500,
                  borderRadius: 'calc(var(--radius) - 2px)',
                  border: visible ? '1px solid var(--primary)' : '1px solid var(--border)',
                  backgroundColor: visible ? 'var(--secondary)' : 'transparent',
                  color: visible ? 'var(--foreground)' : 'var(--muted-foreground)',
                  cursor: 'pointer',
                  transition: 'all 0.15s ease',
                }}
              >
                {visible && <Check size={12} />}
                <span>{p}</span>
              </button>
            );
          })}
          {participants.size === 0 && (
            <span style={{ fontSize: '12px', color: 'var(--muted-foreground)', fontStyle: 'italic' }}>
              참가자 정보가 없습니다.
            </span>
          )}
        </div>
      </div>

      {/* UI 요소 필터 카드 */}
      {uiClasses.length > 0 && (
        <div className="shadcn-card" style={{
          backgroundColor: 'var(--card)',
          border: '1px solid var(--border)',
          borderRadius: 'var(--radius)',
          padding: '14px 16px',
          display: 'flex',
          flexDirection: 'column',
          gap: '12px',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <EyeOff size={16} style={{ color: 'var(--foreground)' }} />
            <h4 style={{ margin: 0, fontSize: '13px', fontWeight: 600, color: 'var(--foreground)' }}>UI 요소 필터</h4>
          </div>
          <p style={{ margin: 0, fontSize: '12px', color: 'var(--muted-foreground)', lineHeight: 1.4 }}>
            숨길 UI 요소를 선택하세요 (체크 시 해당 요소가 로그에서 숨겨집니다)
          </p>

          <div style={{
            display: 'flex',
            flexDirection: 'column',
            gap: '2px',
            border: '1px solid var(--border)',
            borderRadius: 'var(--radius)',
            overflow: 'hidden',
            backgroundColor: 'var(--background)',
          }}>
            {uiClasses.map((classInfo, idx) => {
              const isChecked = settings.customFilters?.[classInfo.name] ?? false;
              return (
                <label
                  key={classInfo.name}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '10px',
                    padding: '8px 12px',
                    fontSize: '12px',
                    color: 'var(--foreground)',
                    cursor: 'pointer',
                    backgroundColor: isChecked ? 'var(--muted)' : 'transparent',
                    borderBottom: idx < uiClasses.length - 1 ? '1px solid var(--border)' : 'none',
                    transition: 'background-color 0.15s ease',
                  }}
                >
                  <Checkbox
                    checked={isChecked}
                    onChange={(e) => handleCustomFilterChange(classInfo.name, e.target.checked)}
                  />
                  <span style={{ fontWeight: 500 }}>{classInfo.displayName}</span>
                  <span style={{ marginLeft: 'auto', fontSize: '11px', color: 'var(--muted-foreground)', fontFamily: 'monospace' }}>
                    .{classInfo.name}
                  </span>
                </label>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};

export default FilterTab;