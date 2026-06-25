import React from 'react';
import type { UIClassInfo } from '../utils/domUtils';
import { Tag, Checkbox, Divider, List } from 'antd';

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
    <div className="tab-content" style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      <div className="tab-section">
        <h4 className="tab-section-title" style={{ margin: 0, fontSize: '1.1em', fontWeight: 'bold' }}>참가자 필터</h4>
        <p className="section-description" style={{ fontSize: '0.85em', color: 'var(--text-secondary)', margin: '4px 0 12px 0' }}>표시할 참가자를 선택하세요 (선택된 참가자만 로그에 표시됩니다)</p>
        <div className="filter-grid" style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
          {Array.from(participants).map(p => (
            <Tag.CheckableTag
              key={p}
              checked={isParticipantVisible(p)}
              onChange={() => handleParticipantToggle(p)}
              style={{ 
                fontSize: '0.95em', 
                padding: '6px 12px', 
                border: '1px solid var(--border-color)',
                borderRadius: '4px',
                cursor: 'pointer'
              }}
            >
              {p}
            </Tag.CheckableTag>
          ))}
          {participants.size === 0 && (
            <span style={{ fontSize: '0.9em', color: 'var(--text-secondary)' }}>참가자 정보가 없습니다.</span>
          )}
        </div>
      </div>

      {uiClasses.length > 0 && (
        <>
          <Divider style={{ margin: '8px 0' }} />
          <div className="tab-section">
            <h4 className="tab-section-title" style={{ margin: 0, fontSize: '1.1em', fontWeight: 'bold' }}>UI 요소 필터</h4>
            <p className="section-description" style={{ fontSize: '0.85em', color: 'var(--text-secondary)', margin: '4px 0 12px 0' }}>숨길 UI 요소를 선택하세요 (체크 시 해당 요소가 로그에서 숨겨집니다)</p>
            <List
              size="small"
              bordered
              dataSource={uiClasses}
              style={{ background: 'var(--bg-primary)', borderRadius: '6px', borderColor: 'var(--border-color)' }}
              renderItem={classInfo => {
                const isChecked = settings.customFilters?.[classInfo.name] ?? false;
                return (
                  <List.Item style={{ padding: '8px 12px', borderBottom: '1px solid var(--border-color-light)' }}>
                    <Checkbox 
                      checked={isChecked}
                      onChange={(e) => handleCustomFilterChange(classInfo.name, e.target.checked)}
                    >
                      <span className="ui-filter-name" style={{ fontSize: '0.95em', color: 'var(--text-primary)' }}>{classInfo.displayName}</span>
                    </Checkbox>
                  </List.Item>
                );
              }}
            />
          </div>
        </>
      )}
    </div>
  );
};

export default FilterTab;
