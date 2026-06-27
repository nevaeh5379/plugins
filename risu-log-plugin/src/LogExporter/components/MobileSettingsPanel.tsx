/* eslint-disable @typescript-eslint/no-explicit-any */
import React, { useState } from 'react';
import type { UIClassInfo } from '../utils/domUtils';
import { Collapse, Select, Segmented, Switch, Input, Tag, Button, Slider, InputNumber } from 'antd';
import { PlusOutlined } from '@ant-design/icons';

interface MobileSettingsPanelProps {
  settings: any;
  onSettingChange: (key: string, value: any) => void;
  themes: any;
  colors: any;
  participants: Set<string>;
  globalSettings: any;
  onGlobalSettingChange: (key: string, value: any) => void;
  uiClasses: UIClassInfo[];
}

const MobileSettingsPanel: React.FC<MobileSettingsPanelProps> = ({ 
  settings, 
  onSettingChange, 
  themes, 
  colors, 
  participants, 
  globalSettings, 
  onGlobalSettingChange, 
  uiClasses 
}) => {
  const [newProfileClass, setNewProfileClass] = useState('');
  const [newParticipantNameClass, setNewParticipantNameClass] = useState('');

  const handleAddProfileClass = () => {
    if (newProfileClass && !globalSettings.profileClasses?.includes(newProfileClass)) {
      const newClasses = [...(globalSettings.profileClasses || []), newProfileClass];
      onGlobalSettingChange('profileClasses', newClasses);
      setNewProfileClass('');
    }
  };

  const handleRemoveProfileClass = (cls: string) => {
    const newClasses = globalSettings.profileClasses?.filter((c: string) => c !== cls);
    onGlobalSettingChange('profileClasses', newClasses);
  };

  const handleAddParticipantNameClass = () => {
    if (newParticipantNameClass && !globalSettings.participantNameClasses?.includes(newParticipantNameClass)) {
      const newClasses = [...(globalSettings.participantNameClasses || []), newParticipantNameClass];
      onGlobalSettingChange('participantNameClasses', newClasses);
      setNewParticipantNameClass('');
    }
  };

  const handleRemoveParticipantNameClass = (cls: string) => {
    const newClasses = globalSettings.participantNameClasses?.filter((c: string) => c !== cls);
    onGlobalSettingChange('participantNameClasses', newClasses);
  };

  const collapseItems = [
    {
      key: 'ui-theme',
      label: 'UI 테마',
      children: (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <span style={{ fontSize: '0.9em', color: 'var(--text-secondary)' }}>모달창 테마 설정</span>
          <Select 
            value={globalSettings.uiTheme || 'dark'} 
            onChange={(val) => onGlobalSettingChange('uiTheme', val)}
            style={{ width: '100%' }}
          >
            <Select.Option value="dark">다크 모던</Select.Option>
            <Select.Option value="classic">클래식 다크</Select.Option>
            <Select.Option value="light">라이트</Select.Option>
          </Select>
        </div>
      )
    },
    {
      key: 'format',
      label: '출력 형식',
      children: (
        <Segmented 
          value={settings.format || 'basic'}
          onChange={(val) => onSettingChange('format', val)}
          options={[
            { label: '기본', value: 'basic' },
            { label: 'HTML', value: 'html' },
            { label: '마크다운', value: 'markdown' },
            { label: '텍스트', value: 'text' },
          ]}
          block
        />
      )
    },
    // 기본 형식 스타일 옵션
    ...((settings.format === 'basic' || !settings.format) ? [{
      key: 'styles',
      label: '테마 & 색상',
      children: (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            <span>테마</span>
            <Select 
              value={settings.theme || 'basic'} 
              onChange={(val) => onSettingChange('theme', val)}
              style={{ width: '100%' }}
            >
              {Object.entries(themes).map(([key, theme]: [string, any]) => 
                <Select.Option value={key} key={key}>{theme.name}</Select.Option>
              )}
            </Select>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            <span>색상</span>
            <Select 
              value={settings.color || 'dark'} 
              onChange={(val) => onSettingChange('color', val)}
              style={{ width: '100%' }}
            >
              {Object.entries(colors).map(([key, color]: [string, any]) => 
                <Select.Option value={key} key={key}>{color.name}</Select.Option>
              )}
            </Select>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            <span>헤더 레이아웃</span>
            <Select 
              value={settings.headerLayout || 'default'} 
              onChange={(val) => onSettingChange('headerLayout', val)}
              style={{ width: '100%' }}
            >
              <Select.Option value="default">기본</Select.Option>
              <Select.Option value="compact">컴팩트</Select.Option>
              <Select.Option value="banner">배너</Select.Option>
              <Select.Option value="smart">스마트</Select.Option>
              <Select.Option value="cover">커버</Select.Option>
            </Select>
          </div>
        </div>
      )
    }] : []),
    // 커스텀 CSS
    ...(settings.theme === 'custom' ? [{
      key: 'custom-css',
      label: '커스텀 CSS',
      children: (
        <Input.TextArea
          value={settings.customCss || ''}
          onChange={(e) => onSettingChange('customCss', e.target.value)}
          placeholder="여기에 CSS 코드를 입력하세요..."
          autoSize={{ minRows: 6, maxRows: 12 }}
        />
      )
    }] : []),
    // 표시 옵션
    ...((settings.format === 'basic' || !settings.format) ? [{
      key: 'display-options',
      label: '표시 옵션',
      children: (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span>아바타 표시</span>
            <Switch checked={settings.showAvatar !== false} onChange={(val) => onSettingChange('showAvatar', val)} />
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span>말풍선 스타일</span>
            <Switch checked={settings.showBubble !== false} onChange={(val) => onSettingChange('showBubble', val)} />
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span>헤더 표시</span>
            <Switch checked={settings.showHeader !== false} onChange={(val) => onSettingChange('showHeader', val)} />
          </div>
          
          {settings.showHeader !== false && (
            <div style={{ paddingLeft: '12px', borderLeft: '2px solid var(--border-color)', display: 'flex', flexDirection: 'column', gap: '12px', margin: '4px 0' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span>헤더 프로필 이미지</span>
                <Switch checked={settings.showHeaderIcon !== false} onChange={(val) => onSettingChange('showHeaderIcon', val)} />
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <span>헤더 태그</span>
                <Input value={settings.headerTags || ''} onChange={(e) => onSettingChange('headerTags', e.target.value)} placeholder="쉼표로 구분" />
              </div>
              
              {settings.headerLayout === 'banner' && (
                <>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    <span>배너 이미지 URL</span>
                    <Input value={settings.headerBannerUrl || ''} onChange={(e) => onSettingChange('headerBannerUrl', e.target.value)} placeholder="https://..." />
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span>배너 블러 효과</span>
                    <Switch checked={settings.headerBannerBlur !== false} onChange={(val) => onSettingChange('headerBannerBlur', val)} />
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    <span>이미지 정렬 ({settings.headerBannerAlign || 50}%)</span>
                    <Slider 
                      min={0} 
                      max={100} 
                      value={settings.headerBannerAlign || 50} 
                      onChange={(val) => onSettingChange('headerBannerAlign', val)} 
                    />
                  </div>
                </>
              )}
            </div>
          )}

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span>푸터 표시</span>
            <Switch checked={settings.showFooter !== false} onChange={(val) => onSettingChange('showFooter', val)} />
          </div>
          
          {settings.showFooter !== false && (
            <div style={{ paddingLeft: '12px', borderLeft: '2px solid var(--border-color)', display: 'flex', flexDirection: 'column', gap: '8px', margin: '4px 0' }}>
              <Input value={settings.footerLeft || ''} onChange={(e) => onSettingChange('footerLeft', e.target.value)} placeholder="왼쪽 푸터" />
              <Input value={settings.footerCenter || ''} onChange={(e) => onSettingChange('footerCenter', e.target.value)} placeholder="중앙 푸터" />
              <Input value={settings.footerRight || ''} onChange={(e) => onSettingChange('footerRight', e.target.value)} placeholder="오른쪽 푸터" />
            </div>
          )}
        </div>
      )
    }] : []),
    // 이미지 스케일
    ...((settings.format === 'basic' || !settings.format) ? [{
      key: 'image-scale',
      label: '이미지 크기',
      children: (
        <div style={{ display: 'flex', gap: '16px', alignItems: 'center', width: '100%' }}>
          <Slider 
            min={1} 
            max={100} 
            value={settings.imageScale || 100} 
            onChange={(val) => onSettingChange('imageScale', val)}
            style={{ flex: 1 }}
          />
          <InputNumber
            min={1}
            max={100}
            value={settings.imageScale || 100}
            onChange={(val) => onSettingChange('imageScale', val || 100)}
            style={{ width: '65px' }}
          />
        </div>
      )
    }] : []),
    // HTML 옵션
    ...(settings.format === 'html' ? [{
      key: 'html-options',
      label: 'HTML 옵션',
      children: (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span>이미지 Base64 내장</span>
            <Switch checked={settings.embedImages !== false} onChange={(val) => onSettingChange('embedImages', val)} />
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span>호버 요소 펼치기</span>
            <Switch checked={settings.expandHover === true} onChange={(val) => onSettingChange('expandHover', val)} />
          </div>
        </div>
      )
    }] : []),
    // 참가자 필터
    {
      key: 'participants',
      label: '참가자 필터',
      children: (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
          {Array.from(participants).map(p => {
            const isVisible = !globalSettings.filteredParticipants?.includes(p);
            return (
              <Tag.CheckableTag
                key={p}
                checked={isVisible}
                onChange={(checked) => {
                  const currentList = globalSettings.filteredParticipants || [];
                  const newList = checked 
                    ? currentList.filter((name: string) => name !== p)
                    : [...currentList, p];
                  onGlobalSettingChange('filteredParticipants', newList);
                }}
                style={{ border: '1px solid var(--border-color)', padding: '4px 8px' }}
              >
                {p}
              </Tag.CheckableTag>
            );
          })}
          {participants.size === 0 && <span style={{ color: 'var(--text-secondary)', fontSize: '0.9em' }}>참가자가 없습니다.</span>}
        </div>
      )
    },
    // 커스텀 선택자
    {
      key: 'custom-selectors',
      label: '커스텀 선택자',
      children: (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <span style={{ fontWeight: '500' }}>프로필 이미지 클래스</span>
            <div style={{ display: 'flex', gap: '8px' }}>
              <Input 
                value={newProfileClass} 
                onChange={(e) => setNewProfileClass(e.target.value)}
                placeholder="예: .avatar"
                onKeyDown={(e) => e.key === 'Enter' && handleAddProfileClass()}
                style={{ flex: 1 }}
              />
              <Button icon={<PlusOutlined />} onClick={handleAddProfileClass}>추가</Button>
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
              {globalSettings.profileClasses?.map((cls: string) => (
                <Tag key={cls} closable onClose={() => handleRemoveProfileClass(cls)}>
                  {cls}
                </Tag>
              ))}
            </div>
          </div>
          
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <span style={{ fontWeight: '500' }}>참가자 이름 클래스</span>
            <div style={{ display: 'flex', gap: '8px' }}>
              <Input 
                value={newParticipantNameClass} 
                onChange={(e) => setNewParticipantNameClass(e.target.value)}
                placeholder="예: .username"
                onKeyDown={(e) => e.key === 'Enter' && handleAddParticipantNameClass()}
                style={{ flex: 1 }}
              />
              <Button icon={<PlusOutlined />} onClick={handleAddParticipantNameClass}>추가</Button>
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
              {globalSettings.participantNameClasses?.map((cls: string) => (
                <Tag key={cls} closable onClose={() => handleRemoveParticipantNameClass(cls)}>
                  {cls}
                </Tag>
              ))}
            </div>
          </div>
        </div>
      )
    },
    // UI 요소 필터
    ...(uiClasses.length > 0 ? [{
      key: 'ui-filters',
      label: 'UI 요소 필터',
      children: (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {uiClasses.map(classInfo => {
            const isChecked = settings.customFilters?.[classInfo.name] ?? false;
            return (
              <div key={classInfo.name} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontFamily: 'monospace', fontSize: '0.9em' }}>{classInfo.displayName}</span>
                <Switch 
                  checked={isChecked} 
                  onChange={(checked) => {
                    const newFilters = { ...(settings.customFilters || {}), [classInfo.name]: checked };
                    onSettingChange('customFilters', newFilters);
                  }}
                  size="small"
                />
              </div>
            );
          })}
        </div>
      )
    }] : [])
  ];

  return (
    <div className="mobile-settings-container" style={{ padding: '8px 4px' }}>
      <Collapse 
        items={collapseItems} 
        defaultActiveKey={['format', 'styles']} 
        expandIconPosition="end"
        style={{ border: 'none', background: 'transparent' }}
      />
    </div>
  );
};

export default MobileSettingsPanel;
