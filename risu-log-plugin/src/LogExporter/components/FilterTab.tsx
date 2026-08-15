import React, { useState, useMemo, useCallback } from 'react';
import type { UIClassInfo } from '../utils/domUtils';
import type { GlobalSettings } from '../../types';
import type { LogExporterSettings, CustomFiltersMap } from '../hooks/types';
import {
  Users,
  EyeOff,
  Eye,
  Check,
  Search,
  X,
  Image as ImageIcon,
  CheckCheck,
  RotateCcw,
} from 'lucide-react';
import { Checkbox, Input, Button } from '../../components/ui';

// ─── Component Props ────────────────────────────────────────────────────────

export interface FilterTabProps {
  settings: Partial<LogExporterSettings> & Record<string, unknown>;
  onSettingChange: (key: string, value: unknown) => void;
  participants: Set<string>;
  globalSettings: Partial<GlobalSettings> & Record<string, unknown>;
  onGlobalSettingChange: (key: string, value: unknown) => void;
  uiClasses: UIClassInfo[];
}

// ─── Reusable Card Header ───────────────────────────────────────────────────

interface SectionHeaderProps {
  icon: React.ReactNode;
  title: string;
  badge?: string;
  description: string;
}

const SectionHeader: React.FC<SectionHeaderProps> = ({
  icon,
  title,
  badge,
  description,
}) => (
  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
        <span style={{ color: 'var(--foreground)', display: 'flex', alignItems: 'center' }}>
          {icon}
        </span>
        <h4 style={{ margin: 0, fontSize: '13px', fontWeight: 600, color: 'var(--foreground)' }}>
          {title}
        </h4>
      </div>
      {badge && (
        <span
          style={{
            fontSize: '11px',
            fontWeight: 500,
            padding: '2px 8px',
            borderRadius: '9999px',
            backgroundColor: 'var(--muted)',
            color: 'var(--muted-foreground)',
            border: '1px solid var(--border)',
            whiteSpace: 'nowrap',
          }}
        >
          {badge}
        </span>
      )}
    </div>
    <p style={{ margin: 0, fontSize: '12px', color: 'var(--muted-foreground)', lineHeight: 1.4 }}>
      {description}
    </p>
  </div>
);

// ─── Participant Filter Section ─────────────────────────────────────────────

interface ParticipantFilterSectionProps {
  participants: Set<string>;
  filteredParticipants: string[];
  onToggleParticipant: (participant: string) => void;
  onShowAll: () => void;
  onHideAll: () => void;
  onInvert: () => void;
}

const ParticipantFilterSection: React.FC<ParticipantFilterSectionProps> = ({
  participants,
  filteredParticipants,
  onToggleParticipant,
  onShowAll,
  onHideAll,
  onInvert,
}) => {
  const [searchQuery, setSearchQuery] = useState('');

  const participantList = useMemo(() => Array.from(participants), [participants]);

  const visibleParticipants = useMemo(() => {
    return participantList.filter((p) => !filteredParticipants.includes(p));
  }, [participantList, filteredParticipants]);

  const filteredList = useMemo(() => {
    if (!searchQuery.trim()) return participantList;
    const query = searchQuery.trim().toLowerCase();
    return participantList.filter((p) => p.toLowerCase().includes(query));
  }, [participantList, searchQuery]);

  const totalCount = participantList.length;
  const visibleCount = visibleParticipants.length;

  return (
    <div
      className="shadcn-card"
      style={{
        backgroundColor: 'var(--card)',
        border: '1px solid var(--border)',
        borderRadius: 'var(--radius)',
        padding: '14px 16px',
        display: 'flex',
        flexDirection: 'column',
        gap: '12px',
      }}
    >
      <SectionHeader
        icon={<Users size={16} />}
        title="참가자 필터"
        badge={totalCount > 0 ? `${visibleCount}/${totalCount}명 표시` : undefined}
        description="표시할 참가자를 선택하세요 (선택된 참가자만 로그에 표시됩니다)"
      />

      {totalCount > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {/* Quick Actions & Search Bar */}
          <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: '8px' }}>
            {totalCount > 3 && (
              <div style={{ flex: '1 1 180px', maxWidth: '240px' }}>
                <Input
                  size="small"
                  placeholder="참가자 검색..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  prefix={<Search size={13} style={{ color: 'var(--muted-foreground)' }} />}
                  suffix={
                    searchQuery ? (
                      <X
                        size={13}
                        style={{ cursor: 'pointer', color: 'var(--muted-foreground)' }}
                        onClick={() => setSearchQuery('')}
                      />
                    ) : null
                  }
                />
              </div>
            )}

            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginLeft: 'auto' }}>
              <Button
                size="small"
                variant="outline"
                onClick={onShowAll}
                disabled={visibleCount === totalCount}
                style={{ fontSize: '11px', height: '26px', padding: '0 8px' }}
                icon={<Eye size={12} />}
              >
                모두 표시
              </Button>
              <Button
                size="small"
                variant="outline"
                onClick={onHideAll}
                disabled={visibleCount === 0}
                style={{ fontSize: '11px', height: '26px', padding: '0 8px' }}
                icon={<EyeOff size={12} />}
              >
                모두 숨김
              </Button>
              <Button
                size="small"
                variant="ghost"
                onClick={onInvert}
                style={{ fontSize: '11px', height: '26px', padding: '0 8px' }}
                icon={<RotateCcw size={12} />}
              >
                반전
              </Button>
            </div>
          </div>

          {/* Participant Chip Tags */}
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginTop: '4px' }}>
            {filteredList.map((participant) => {
              const isVisible = !filteredParticipants.includes(participant);
              return (
                <button
                  key={participant}
                  type="button"
                  onClick={() => onToggleParticipant(participant)}
                  title={isVisible ? '클릭하여 숨기기' : '클릭하여 표시하기'}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '6px',
                    padding: '5px 10px',
                    fontSize: '12px',
                    fontWeight: isVisible ? 600 : 500,
                    borderRadius: 'calc(var(--radius) - 2px)',
                    border: isVisible ? '1px solid var(--primary)' : '1px solid var(--border)',
                    backgroundColor: isVisible ? 'var(--secondary)' : 'transparent',
                    color: isVisible ? 'var(--foreground)' : 'var(--muted-foreground)',
                    cursor: 'pointer',
                    transition: 'all 0.15s ease',
                    userSelect: 'none',
                    opacity: isVisible ? 1 : 0.65,
                  }}
                >
                  {isVisible ? (
                    <Check size={12} style={{ color: 'var(--primary)', flexShrink: 0 }} />
                  ) : (
                    <EyeOff size={12} style={{ color: 'var(--muted-foreground)', flexShrink: 0 }} />
                  )}
                  <span>{participant}</span>
                </button>
              );
            })}

            {filteredList.length === 0 && searchQuery && (
              <span style={{ fontSize: '12px', color: 'var(--muted-foreground)', fontStyle: 'italic', padding: '4px 0' }}>
                '{searchQuery}' 와(과) 일치하는 참가자가 없습니다.
              </span>
            )}
          </div>
        </div>
      )}

      {totalCount === 0 && (
        <div
          style={{
            padding: '20px 16px',
            textAlign: 'center',
            backgroundColor: 'var(--background)',
            borderRadius: 'var(--radius)',
            border: '1px dashed var(--border)',
          }}
        >
          <span style={{ fontSize: '12px', color: 'var(--muted-foreground)' }}>
            감지된 참가자 정보가 없습니다.
          </span>
        </div>
      )}
    </div>
  );
};

// ─── UI Class Item Row ──────────────────────────────────────────────────────

interface UiClassItemProps {
  classInfo: UIClassInfo;
  isChecked: boolean;
  isLast: boolean;
  onToggle: (className: string, isChecked: boolean) => void;
}

const UiClassItem: React.FC<UiClassItemProps> = ({
  classInfo,
  isChecked,
  isLast,
  onToggle,
}) => {
  // Extract hierarchy depth & child prefix for cleaner visual layout
  const isChild = classInfo.displayName.includes('└');
  const indentCount = (classInfo.displayName.match(/\s{2}/g) || []).length;
  const rawDisplayName = classInfo.displayName
    .replace(/^[\s└]+/, '')
    .replace(/\s*\(이미지 포함\)$/, '')
    .trim();

  return (
    <label
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '10px',
        padding: '8px 12px',
        paddingLeft: isChild ? `${Math.max(12, 12 + indentCount * 14)}px` : '12px',
        fontSize: '12px',
        color: 'var(--foreground)',
        cursor: 'pointer',
        backgroundColor: isChecked ? 'var(--muted)' : 'transparent',
        borderBottom: isLast ? 'none' : '1px solid var(--border)',
        transition: 'background-color 0.15s ease',
        userSelect: 'none',
      }}
    >
      <Checkbox
        checked={isChecked}
        onChange={(e) => onToggle(classInfo.name, e.target.checked)}
      />

      {isChild && (
        <span
          style={{
            color: 'var(--muted-foreground)',
            fontSize: '11px',
            userSelect: 'none',
            flexShrink: 0,
          }}
        >
          └
        </span>
      )}

      <span
        style={{
          fontWeight: isChecked ? 600 : 500,
          color: isChecked ? 'var(--foreground)' : 'var(--foreground)',
          textDecoration: isChecked ? 'line-through' : 'none',
          opacity: isChecked ? 0.75 : 1,
        }}
      >
        {rawDisplayName || classInfo.name}
      </span>

      {classInfo.hasImage && (
        <span
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '3px',
            fontSize: '10px',
            fontWeight: 500,
            padding: '1px 6px',
            borderRadius: '4px',
            backgroundColor: 'rgba(59, 130, 246, 0.12)',
            color: '#3b82f6',
            border: '1px solid rgba(59, 130, 246, 0.25)',
            flexShrink: 0,
          }}
        >
          <ImageIcon size={10} />
          <span>이미지</span>
        </span>
      )}

      <span
        style={{
          marginLeft: 'auto',
          fontSize: '11px',
          color: 'var(--muted-foreground)',
          fontFamily: 'monospace',
          backgroundColor: 'var(--muted)',
          padding: '1px 6px',
          borderRadius: '4px',
          border: '1px solid var(--border)',
          whiteSpace: 'nowrap',
          maxWidth: '180px',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
        }}
      >
        .{classInfo.name}
      </span>
    </label>
  );
};

// ─── UI Class Filter Section ────────────────────────────────────────────────

interface UiClassFilterSectionProps {
  uiClasses: UIClassInfo[];
  customFilters: CustomFiltersMap;
  onToggleClass: (className: string, isChecked: boolean) => void;
  onBatchToggle: (classNames: string[], isChecked: boolean) => void;
}

const UiClassFilterSection: React.FC<UiClassFilterSectionProps> = ({
  uiClasses,
  customFilters,
  onToggleClass,
  onBatchToggle,
}) => {
  const [searchQuery, setSearchQuery] = useState('');

  const hiddenCount = useMemo(() => {
    return uiClasses.filter((c) => customFilters[c.name] === true).length;
  }, [uiClasses, customFilters]);

  const filteredClasses = useMemo(() => {
    if (!searchQuery.trim()) return uiClasses;
    const query = searchQuery.trim().toLowerCase();
    return uiClasses.filter(
      (c) =>
        c.name.toLowerCase().includes(query) ||
        c.displayName.toLowerCase().includes(query)
    );
  }, [uiClasses, searchQuery]);

  const handleHideAll = () => {
    const targets = filteredClasses.map((c) => c.name);
    onBatchToggle(targets, true);
  };

  const handleShowAll = () => {
    const targets = filteredClasses.map((c) => c.name);
    onBatchToggle(targets, false);
  };

  return (
    <div
      className="shadcn-card"
      style={{
        backgroundColor: 'var(--card)',
        border: '1px solid var(--border)',
        borderRadius: 'var(--radius)',
        padding: '14px 16px',
        display: 'flex',
        flexDirection: 'column',
        gap: '12px',
      }}
    >
      <SectionHeader
        icon={<EyeOff size={16} />}
        title="UI 요소 필터"
        badge={hiddenCount > 0 ? `${hiddenCount}개 숨김 중` : undefined}
        description="숨길 UI 요소를 선택하세요 (체크 시 해당 요소가 로그에서 제외됩니다)"
      />

      {/* Action Bar: Search & Batch Controls */}
      <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: '8px' }}>
        <div style={{ flex: '1 1 180px', maxWidth: '240px' }}>
          <Input
            size="small"
            placeholder="클래스 검색..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            prefix={<Search size={13} style={{ color: 'var(--muted-foreground)' }} />}
            suffix={
              searchQuery ? (
                <X
                  size={13}
                  style={{ cursor: 'pointer', color: 'var(--muted-foreground)' }}
                  onClick={() => setSearchQuery('')}
                />
              ) : null
            }
          />
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginLeft: 'auto' }}>
          <Button
            size="small"
            variant="outline"
            onClick={handleHideAll}
            style={{ fontSize: '11px', height: '26px', padding: '0 8px' }}
            icon={<CheckCheck size={12} />}
          >
            모두 숨김
          </Button>
          <Button
            size="small"
            variant="outline"
            onClick={handleShowAll}
            style={{ fontSize: '11px', height: '26px', padding: '0 8px' }}
            icon={<RotateCcw size={12} />}
          >
            모두 표시
          </Button>
        </div>
      </div>

      {/* Class List Table */}
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          border: '1px solid var(--border)',
          borderRadius: 'var(--radius)',
          overflow: 'hidden',
          backgroundColor: 'var(--background)',
          maxHeight: '380px',
          overflowY: 'auto',
        }}
      >
        {filteredClasses.map((classInfo, idx) => {
          const isChecked = customFilters[classInfo.name] ?? false;
          return (
            <UiClassItem
              key={classInfo.name}
              classInfo={classInfo}
              isChecked={isChecked}
              isLast={idx === filteredClasses.length - 1}
              onToggle={onToggleClass}
            />
          );
        })}

        {filteredClasses.length === 0 && (
          <div
            style={{
              padding: '24px 16px',
              textAlign: 'center',
              color: 'var(--muted-foreground)',
              fontSize: '12px',
            }}
          >
            {searchQuery
              ? `'${searchQuery}' 와(과) 일치하는 UI 요소가 없습니다.`
              : '필터링 가능한 커스텀 UI 요소가 없습니다.'}
          </div>
        )}
      </div>
    </div>
  );
};

// ─── Main Component ─────────────────────────────────────────────────────────

/**
 * FilterTab provides configuration panels for participant visibility filtering
 * and custom UI class element exclusion rules for chat log exports.
 */
const FilterTab: React.FC<FilterTabProps> = ({
  settings,
  onSettingChange,
  participants,
  globalSettings,
  onGlobalSettingChange,
  uiClasses,
}) => {
  const customFilters = useMemo<CustomFiltersMap>(() => {
    return (settings.customFilters as CustomFiltersMap) || {};
  }, [settings.customFilters]);

  const filteredParticipants = useMemo<string[]>(() => {
    return Array.isArray(globalSettings.filteredParticipants)
      ? globalSettings.filteredParticipants
      : [];
  }, [globalSettings.filteredParticipants]);

  // Handle single class filter toggle
  const handleCustomFilterChange = useCallback(
    (className: string, isChecked: boolean) => {
      const newFilters: CustomFiltersMap = {
        ...customFilters,
        [className]: isChecked,
      };
      onSettingChange('customFilters', newFilters);
    },
    [customFilters, onSettingChange]
  );

  // Handle batch class filter toggle
  const handleCustomFilterBatchChange = useCallback(
    (classNames: string[], isChecked: boolean) => {
      const newFilters: CustomFiltersMap = { ...customFilters };
      classNames.forEach((name) => {
        newFilters[name] = isChecked;
      });
      onSettingChange('customFilters', newFilters);
    },
    [customFilters, onSettingChange]
  );

  // Handle single participant toggle
  const handleParticipantToggle = useCallback(
    (participant: string) => {
      const isHidden = filteredParticipants.includes(participant);
      const newList = isHidden
        ? filteredParticipants.filter((p) => p !== participant)
        : [...filteredParticipants, participant];
      onGlobalSettingChange('filteredParticipants', newList);
    },
    [filteredParticipants, onGlobalSettingChange]
  );

  // Handle participant batch actions
  const handleParticipantShowAll = useCallback(() => {
    onGlobalSettingChange('filteredParticipants', []);
  }, [onGlobalSettingChange]);

  const handleParticipantHideAll = useCallback(() => {
    onGlobalSettingChange('filteredParticipants', Array.from(participants));
  }, [participants, onGlobalSettingChange]);

  const handleParticipantInvert = useCallback(() => {
    const allParticipants = Array.from(participants);
    const newList = allParticipants.filter((p) => !filteredParticipants.includes(p));
    onGlobalSettingChange('filteredParticipants', newList);
  }, [participants, filteredParticipants, onGlobalSettingChange]);

  return (
    <div
      className="tab-content"
      style={{
        padding: '16px',
        display: 'flex',
        flexDirection: 'column',
        gap: '20px',
      }}
    >
      {/* 1. Participant Filter Section */}
      <ParticipantFilterSection
        participants={participants}
        filteredParticipants={filteredParticipants}
        onToggleParticipant={handleParticipantToggle}
        onShowAll={handleParticipantShowAll}
        onHideAll={handleParticipantHideAll}
        onInvert={handleParticipantInvert}
      />

      {/* 2. UI Class Element Filter Section */}
      {uiClasses.length > 0 && (
        <UiClassFilterSection
          uiClasses={uiClasses}
          customFilters={customFilters}
          onToggleClass={handleCustomFilterChange}
          onBatchToggle={handleCustomFilterBatchChange}
        />
      )}
    </div>
  );
};

export default FilterTab;