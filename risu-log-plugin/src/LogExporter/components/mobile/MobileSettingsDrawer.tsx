/* eslint-disable @typescript-eslint/no-explicit-any */
import React, { useState, useMemo } from 'react';
import {
  Palette,
  Filter,
  Replace,
  SlidersHorizontal,
  Settings,
  X,
  Check,
  Plus,
  Trash2,
  Edit2,
  Search,
  Users,
  Eye,
  EyeOff,
  Sparkles,
  Layout,
  Type,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

import type { ThemeInfo, ColorPalette, ReplacementRule } from '../../../types';
import type { UIClassInfo } from '../../utils/domUtils';
import { HEADER_LAYOUT_OPTIONS } from '../constants';
import SettingToggle from '../SettingToggle';

// ─── Types & Constants ────────────────────────────────────────────────────────

export type MobileSettingsTabKey = 'style' | 'filter' | 'replacement' | 'advanced' | 'plugin';

export interface MobileTabItemConfig {
  readonly key: MobileSettingsTabKey;
  readonly label: string;
  readonly icon: LucideIcon;
}

export interface MobileSettingsDrawerProps {
  open: boolean;
  onClose: () => void;
  activeTab: string;
  onTabChange: (key: string) => void;
  settings: any;
  onSettingChange: (key: string, value: any) => void;
  participants: Set<string>;
  globalSettings: any;
  onGlobalSettingChange: (key: string, value: any) => void;
  uiClasses: UIClassInfo[];
  imageSizeWarning?: string;
  themes: Record<string, ThemeInfo>;
  colors: Record<string, ColorPalette>;
  dataTheme?: string;
}

const TAB_ITEMS: readonly MobileTabItemConfig[] = [
  { key: 'style', label: '스타일', icon: Palette },
  { key: 'filter', label: '필터', icon: Filter },
  { key: 'replacement', label: '바꾸기', icon: Replace },
  { key: 'advanced', label: '고급', icon: SlidersHorizontal },
  { key: 'plugin', label: '플러그인', icon: Settings },
] as const;

// ─── Sub-Component: Stepper Control ──────────────────────────────────────────

interface StepperProps {
  label: string;
  value: number;
  unit?: string;
  step?: number;
  min?: number;
  max?: number;
  onChange: (val: number) => void;
}

const MobileStepper: React.FC<StepperProps> = ({
  label,
  value,
  unit = '',
  step = 1,
  min = 1,
  max = 9999,
  onChange,
}) => (
  <div className="mobile-stepper-row">
    <span className="mobile-stepper-label">{label}</span>
    <div className="mobile-stepper-controls">
      <button
        type="button"
        className="mobile-stepper-btn"
        onClick={() => onChange(Math.max(min, value - step))}
        disabled={value <= min}
      >
        -
      </button>
      <span className="mobile-stepper-value">
        {value}
        {unit}
      </span>
      <button
        type="button"
        className="mobile-stepper-btn"
        onClick={() => onChange(Math.min(max, value + step))}
        disabled={value >= max}
      >
        +
      </button>
    </div>
  </div>
);

// ─── Main Mobile Settings Drawer Component ───────────────────────────────────

export const MobileSettingsDrawer: React.FC<MobileSettingsDrawerProps> = ({
  open,
  onClose,
  activeTab,
  onTabChange,
  settings,
  onSettingChange,
  participants,
  globalSettings,
  onGlobalSettingChange,
  themes,
  colors,
  dataTheme,
}) => {
  if (!open) return null;

  const currentTab = (activeTab as MobileSettingsTabKey) || 'style';

  // ── Search & Filter State for Participants ──
  const [participantSearch, setParticipantSearch] = useState('');
  const participantList = useMemo(() => Array.from(participants), [participants]);
  const filteredParticipants: string[] = settings.filteredParticipants || [];

  const displayedParticipants = useMemo(() => {
    if (!participantSearch.trim()) return participantList;
    const q = participantSearch.toLowerCase();
    return participantList.filter((p) => p.toLowerCase().includes(q));
  }, [participantList, participantSearch]);

  const handleToggleParticipant = (name: string) => {
    const isHidden = filteredParticipants.includes(name);
    const updated = isHidden
      ? filteredParticipants.filter((p) => p !== name)
      : [...filteredParticipants, name];
    onSettingChange('filteredParticipants', updated);
  };

  const handleShowAllParticipants = () => onSettingChange('filteredParticipants', []);
  const handleHideAllParticipants = () => onSettingChange('filteredParticipants', [...participantList]);
  const handleInvertParticipants = () => {
    const inverted = participantList.filter((p) => !filteredParticipants.includes(p));
    onSettingChange('filteredParticipants', inverted);
  };

  // ── Replacement Rule State ──
  const [isAddingRule, setIsAddingRule] = useState(false);
  const [editingRuleId, setEditingRuleId] = useState<string | null>(null);
  const [rulePattern, setRulePattern] = useState('');
  const [ruleReplacement, setRuleReplacement] = useState('');
  const [ruleIsRegex, setRuleIsRegex] = useState(false);

  const rules: ReplacementRule[] = settings.replacementRules || [];

  const handleSaveRule = () => {
    if (!rulePattern.trim()) return;
    if (editingRuleId) {
      const updated = rules.map((r) =>
        r.id === editingRuleId
          ? { ...r, pattern: rulePattern, replacement: ruleReplacement, isRegex: ruleIsRegex }
          : r,
      );
      onSettingChange('replacementRules', updated);
      setEditingRuleId(null);
    } else {
      const newRule: ReplacementRule = {
        id: `rule-${Date.now()}`,
        pattern: rulePattern,
        replacement: ruleReplacement,
        isRegex: ruleIsRegex,
        flags: 'g',
      };
      onSettingChange('replacementRules', [...rules, newRule]);
      setIsAddingRule(false);
    }
    setRulePattern('');
    setRuleReplacement('');
    setRuleIsRegex(false);
  };

  const handleDeleteRule = (id: string) => {
    onSettingChange(
      'replacementRules',
      rules.filter((r) => r.id !== id),
    );
  };

  const handleStartEditRule = (rule: ReplacementRule) => {
    setEditingRuleId(rule.id);
    setRulePattern(rule.pattern);
    setRuleReplacement(rule.replacement);
    setRuleIsRegex(!!rule.isRegex);
    setIsAddingRule(true);
  };

  // ── Style Tab Helpers ──
  const currentThemeKey = settings.theme || 'basic';
  const currentColorKey = typeof settings.color === 'string' ? settings.color : 'dark';
  const currentHeaderLayout = settings.headerLayout || 'default';

  return (
    <div className="mobile-sheet-backdrop" data-theme={dataTheme} onClick={onClose}>
      <div
        className="mobile-sheet-content mobile-settings-sheet-content"
        data-theme={dataTheme}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label="설정"
      >
        {/* Top Grabber */}
        <div className="mobile-sheet-grabber-wrapper">
          <div className="mobile-sheet-grabber" />
        </div>

        {/* Single Mobile Sheet Header */}
        <div className="mobile-sheet-header">
          <div className="mobile-sheet-title-group">
            <Settings size={18} />
            <h3 className="mobile-sheet-title">설정</h3>
          </div>
          <button
            type="button"
            className="mobile-sheet-close-btn"
            onClick={onClose}
            aria-label="닫기"
          >
            <X size={16} />
          </button>
        </div>

        {/* Horizontal Category Pill Bar */}
        <nav className="mobile-settings-nav-bar" aria-label="설정 분류">
          <div className="mobile-settings-nav-scroll">
            {TAB_ITEMS.map((tab) => {
              const isActive = currentTab === tab.key;
              const Icon = tab.icon;
              return (
                <button
                  key={tab.key}
                  type="button"
                  className={`mobile-settings-nav-pill ${isActive ? 'active' : ''}`}
                  onClick={() => onTabChange(tab.key)}
                  aria-selected={isActive}
                >
                  <Icon size={14} />
                  <span>{tab.label}</span>
                </button>
              );
            })}
          </div>
        </nav>

        {/* Scrollable Tab Content Body */}
        <div className="mobile-sheet-body mobile-settings-body">
          {/* ═══════════════════════════════════════════════════════════════════
              TAB 1: STYLE (스타일)
              ═══════════════════════════════════════════════════════════════════ */}
          {currentTab === 'style' && (
            <div className="mobile-settings-tab-section">
              {/* Themes */}
              <div className="mobile-settings-card">
                <div className="mobile-card-title">
                  <Palette size={15} />
                  <span>테마 선택</span>
                </div>
                <div className="mobile-chip-grid">
                  {Object.entries(themes).map(([key, theme]) => {
                    const isSelected = currentThemeKey === key;
                    return (
                      <button
                        key={key}
                        type="button"
                        className={`mobile-theme-chip ${isSelected ? 'selected' : ''}`}
                        onClick={() => onSettingChange('theme', key)}
                      >
                        <span className="mobile-chip-name">{theme.name}</span>
                        {isSelected && <Check size={12} />}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Color Palettes */}
              <div className="mobile-settings-card">
                <div className="mobile-card-title">
                  <Sparkles size={15} />
                  <span>색상 팔레트</span>
                </div>
                <div className="mobile-chip-grid">
                  {Object.entries(colors).map(([key, color]) => {
                    const isSelected = currentColorKey === key;
                    return (
                      <button
                        key={key}
                        type="button"
                        className={`mobile-color-chip ${isSelected ? 'selected' : ''}`}
                        onClick={() => onSettingChange('color', key)}
                      >
                        <span
                          className="mobile-color-dot"
                          style={{
                            backgroundColor: color.cardBgUser || color.background || '#3b82f6',
                          }}
                        />
                        <span className="mobile-chip-name">{color.name}</span>
                        {isSelected && <Check size={12} />}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Header Layout */}
              <div className="mobile-settings-card">
                <div className="mobile-card-title">
                  <Layout size={15} />
                  <span>헤더 레이아웃</span>
                </div>
                <div className="mobile-header-layout-grid">
                  {HEADER_LAYOUT_OPTIONS.map((layout) => {
                    const isSelected = currentHeaderLayout === layout.value;
                    return (
                      <button
                        key={layout.value}
                        type="button"
                        className={`mobile-layout-btn ${isSelected ? 'selected' : ''}`}
                        onClick={() => onSettingChange('headerLayout', layout.value)}
                      >
                        <span className="mobile-layout-label">{layout.label}</span>
                        <span className="mobile-layout-desc">{layout.description}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Display Toggles */}
              <div className="mobile-settings-card">
                <div className="mobile-card-title">
                  <Eye size={15} />
                  <span>표시 항목</span>
                </div>
                <div className="mobile-toggles-list">
                  <SettingToggle
                    label="헤더 영역 표시"
                    description="상단 캐릭터 타이틀 및 정보 영역"
                    checked={settings.showHeader ?? true}
                    onChange={(val) => onSettingChange('showHeader', val)}
                  />
                  <SettingToggle
                    label="푸터 영역 표시"
                    description="하단 로고 및 부가 정보 영역"
                    checked={settings.showFooter ?? true}
                    onChange={(val) => onSettingChange('showFooter', val)}
                  />
                  <SettingToggle
                    label="아바타 표시"
                    description="캐릭터 및 사용자 프로필 이미지"
                    checked={settings.showAvatar ?? true}
                    onChange={(val) => onSettingChange('showAvatar', val)}
                  />
                  <SettingToggle
                    label="말풍선 박스 표시"
                    description="메시지 내용 주변 말풍선 카드"
                    checked={settings.showBubble ?? true}
                    onChange={(val) => onSettingChange('showBubble', val)}
                  />
                  <SettingToggle
                    label="호버 내용 강제 확장"
                    description="마우스 호버 시 펼쳐지는 내용 상시 표시"
                    checked={settings.expandHover ?? false}
                    onChange={(val) => onSettingChange('expandHover', val)}
                  />
                </div>
              </div>

              {/* Typography & Width */}
              <div className="mobile-settings-card">
                <div className="mobile-card-title">
                  <Type size={15} />
                  <span>글자 크기 및 너비</span>
                </div>
                <div className="mobile-steppers-list">
                  <MobileStepper
                    label="기본 폰트 크기"
                    value={settings.previewFontSize || 16}
                    unit="px"
                    step={1}
                    min={10}
                    max={36}
                    onChange={(val) => onSettingChange('previewFontSize', val)}
                  />
                  <MobileStepper
                    label="로그 컨테이너 너비"
                    value={settings.previewWidth || 800}
                    unit="px"
                    step={50}
                    min={320}
                    max={1920}
                    onChange={(val) => onSettingChange('previewWidth', val)}
                  />
                </div>
              </div>
            </div>
          )}

          {/* ═══════════════════════════════════════════════════════════════════
              TAB 2: FILTER (필터)
              ═══════════════════════════════════════════════════════════════════ */}
          {currentTab === 'filter' && (
            <div className="mobile-settings-tab-section">
              {/* Participant Filter */}
              <div className="mobile-settings-card">
                <div className="mobile-card-title">
                  <Users size={15} />
                  <span>참여자 필터 ({participantList.length}명)</span>
                </div>

                {/* Search */}
                <div className="mobile-search-box">
                  <Search size={14} className="mobile-search-icon" />
                  <input
                    type="search"
                    placeholder="참여자 이름 검색..."
                    value={participantSearch}
                    onChange={(e) => setParticipantSearch(e.target.value)}
                    className="mobile-search-input"
                  />
                  {participantSearch && (
                    <button
                      type="button"
                      className="mobile-search-clear-btn"
                      onClick={() => setParticipantSearch('')}
                    >
                      <X size={12} />
                    </button>
                  )}
                </div>

                {/* Batch Action Buttons */}
                <div className="mobile-filter-batch-row">
                  <button
                    type="button"
                    className="mobile-batch-btn"
                    onClick={handleShowAllParticipants}
                  >
                    전체 표시
                  </button>
                  <button
                    type="button"
                    className="mobile-batch-btn"
                    onClick={handleHideAllParticipants}
                  >
                    전체 숨기기
                  </button>
                  <button
                    type="button"
                    className="mobile-batch-btn"
                    onClick={handleInvertParticipants}
                  >
                    반전
                  </button>
                </div>

                {/* Participant List */}
                <div className="mobile-participant-list">
                  {displayedParticipants.length === 0 ? (
                    <div className="mobile-empty-hint">검색 결과가 없습니다.</div>
                  ) : (
                    displayedParticipants.map((name) => {
                      const isHidden = filteredParticipants.includes(name);
                      return (
                        <div
                          key={name}
                          className={`mobile-participant-row ${isHidden ? 'hidden-user' : ''}`}
                          onClick={() => handleToggleParticipant(name)}
                        >
                          <div className="mobile-participant-info">
                            <span className="mobile-participant-avatar">
                              {name.slice(0, 1).toUpperCase()}
                            </span>
                            <span className="mobile-participant-name">{name}</span>
                          </div>
                          <button
                            type="button"
                            className={`mobile-visibility-badge ${isHidden ? 'is-hidden' : 'is-visible'}`}
                          >
                            {isHidden ? <EyeOff size={13} /> : <Eye size={13} />}
                            <span>{isHidden ? '숨김' : '표시'}</span>
                          </button>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            </div>
          )}

          {/* ═══════════════════════════════════════════════════════════════════
              TAB 3: REPLACEMENT (바꾸기)
              ═══════════════════════════════════════════════════════════════════ */}
          {currentTab === 'replacement' && (
            <div className="mobile-settings-tab-section">
              {/* Header with Add Button */}
              <div className="mobile-settings-card">
                <div className="flex items-center justify-between">
                  <div className="mobile-card-title">
                    <Replace size={15} />
                    <span>단어 치환 규칙 ({rules.length}개)</span>
                  </div>
                  {!isAddingRule && (
                    <button
                      type="button"
                      className="mobile-primary-btn-sm"
                      onClick={() => {
                        setEditingRuleId(null);
                        setRulePattern('');
                        setRuleReplacement('');
                        setRuleIsRegex(false);
                        setIsAddingRule(true);
                      }}
                    >
                      <Plus size={14} />
                      <span>추가</span>
                    </button>
                  )}
                </div>

                {/* Add/Edit Form Card */}
                {isAddingRule && (
                  <div className="mobile-rule-form-card">
                    <h5 className="mobile-rule-form-title">
                      {editingRuleId ? '규칙 수정' : '새 치환 규칙 추가'}
                    </h5>
                    <div className="mobile-input-group">
                      <label className="mobile-input-label">찾을 문자열 / 패턴</label>
                      <input
                        type="text"
                        placeholder="예: {{user}} 또는 욕설"
                        value={rulePattern}
                        onChange={(e) => setRulePattern(e.target.value)}
                        className="mobile-text-input"
                      />
                    </div>
                    <div className="mobile-input-group">
                      <label className="mobile-input-label">바꿀 텍스트</label>
                      <input
                        type="text"
                        placeholder="치환될 내용 (공백 시 삭제)"
                        value={ruleReplacement}
                        onChange={(e) => setRuleReplacement(e.target.value)}
                        className="mobile-text-input"
                      />
                    </div>
                    <SettingToggle
                      label="정규식(RegExp) 사용"
                      checked={ruleIsRegex}
                      onChange={setRuleIsRegex}
                    />
                    <div className="mobile-rule-btn-row">
                      <button
                        type="button"
                        className="mobile-btn-secondary"
                        onClick={() => {
                          setIsAddingRule(false);
                          setEditingRuleId(null);
                        }}
                      >
                        취소
                      </button>
                      <button
                        type="button"
                        className="mobile-btn-primary"
                        onClick={handleSaveRule}
                        disabled={!rulePattern.trim()}
                      >
                        저장
                      </button>
                    </div>
                  </div>
                )}

                {/* Rule List */}
                <div className="mobile-rules-list">
                  {rules.length === 0 ? (
                    <div className="mobile-empty-hint">등록된 치환 규칙이 없습니다.</div>
                  ) : (
                    rules.map((rule) => (
                      <div key={rule.id} className="mobile-rule-item-card">
                        <div className="mobile-rule-item-body">
                          <div className="mobile-rule-pattern-row">
                            <span className="mobile-pattern-badge">패턴</span>
                            <span className="mobile-pattern-text">{rule.pattern}</span>
                          </div>
                          <div className="mobile-rule-arrow">↓</div>
                          <div className="mobile-rule-pattern-row">
                            <span className="mobile-replace-badge">치환</span>
                            <span className="mobile-replace-text">
                              {rule.replacement || '(빈 문자열 - 삭제)'}
                            </span>
                          </div>
                          {rule.isRegex && (
                            <span className="mobile-regex-pill">정규식</span>
                          )}
                        </div>
                        <div className="mobile-rule-actions">
                          <button
                            type="button"
                            className="mobile-rule-icon-btn"
                            onClick={() => handleStartEditRule(rule)}
                            title="수정"
                          >
                            <Edit2 size={14} />
                          </button>
                          <button
                            type="button"
                            className="mobile-rule-icon-btn delete"
                            onClick={() => handleDeleteRule(rule.id)}
                            title="삭제"
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          )}

          {/* ═══════════════════════════════════════════════════════════════════
              TAB 4: ADVANCED (고급)
              ═══════════════════════════════════════════════════════════════════ */}
          {currentTab === 'advanced' && (
            <div className="mobile-settings-tab-section">
              {/* Image Output Settings */}
              <div className="mobile-settings-card">
                <div className="mobile-card-title">
                  <SlidersHorizontal size={15} />
                  <span>이미지 내보내기 설정</span>
                </div>
                {/* Resolution */}
                <div className="mobile-input-group">
                  <label className="mobile-input-label">이미지 해상도 배율</label>
                  <div className="mobile-pill-segmented">
                    {['auto', '1', '2', '3'].map((res) => {
                      const isSel = String(settings.imageResolution ?? 'auto') === String(res);
                      return (
                        <button
                          key={res}
                          type="button"
                          className={`mobile-seg-btn ${isSel ? 'active' : ''}`}
                          onClick={() => onSettingChange('imageResolution', res)}
                        >
                          {res === 'auto' ? '자동' : `${res}x`}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Format */}
                <div className="mobile-input-group">
                  <label className="mobile-input-label">출력 파일 포맷</label>
                  <div className="mobile-pill-segmented">
                    {['png', 'jpeg', 'webp'].map((fmt) => {
                      const isSel = String(settings.imageFormat ?? 'png').toLowerCase() === fmt;
                      return (
                        <button
                          key={fmt}
                          type="button"
                          className={`mobile-seg-btn ${isSel ? 'active' : ''}`}
                          onClick={() => onSettingChange('imageFormat', fmt)}
                        >
                          {fmt.toUpperCase()}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Split Image */}
                <div className="mobile-input-group">
                  <label className="mobile-input-label">대용량 로그 분할 모드</label>
                  <div className="mobile-pill-segmented">
                    {[
                      { key: 'none', label: '분할 안함' },
                      { key: 'chunk', label: '청크 병합' },
                      { key: 'message', label: '메시지별' },
                    ].map((mode) => {
                      const isSel = String(settings.splitImage ?? 'none') === mode.key;
                      return (
                        <button
                          key={mode.key}
                          type="button"
                          className={`mobile-seg-btn ${isSel ? 'active' : ''}`}
                          onClick={() => onSettingChange('splitImage', mode.key)}
                        >
                          {mode.label}
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>

              {/* Avatar Options */}
              <div className="mobile-settings-card">
                <div className="mobile-card-title">
                  <Users size={15} />
                  <span>아바타 프레임 모양</span>
                </div>
                <div className="mobile-chip-grid">
                  {[
                    { key: 'theme', label: '테마 기본' },
                    { key: 'circle', label: '동그라미' },
                    { key: 'square', label: '네모' },
                    { key: 'rounded', label: '둥근 네모' },
                    { key: 'squircle', label: '스쿼클' },
                  ].map((shape) => {
                    const isSel = String(settings.avatarShape ?? 'theme') === shape.key;
                    return (
                      <button
                        key={shape.key}
                        type="button"
                        className={`mobile-theme-chip ${isSel ? 'selected' : ''}`}
                        onClick={() => onSettingChange('avatarShape', shape.key)}
                      >
                        <span>{shape.label}</span>
                        {isSel && <Check size={14} strokeWidth={2.5} />}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Extra Toggles */}
              <div className="mobile-settings-card">
                <div className="mobile-card-title">
                  <Sparkles size={15} />
                  <span>기타 고급 옵션</span>
                </div>
                <div className="mobile-toggles-list">
                  <SettingToggle
                    label="애니메이션 효과 비활성화"
                    description="정적 캡처 시 떨림 현상 방지"
                    checked={settings.disableAnimations ?? false}
                    onChange={(val) => onSettingChange('disableAnimations', val)}
                  />
                  <SettingToggle
                    label="아카라이브 호환 모드"
                    description="아카라이브 본문 복사 최적화"
                    checked={settings.isForArca ?? false}
                    onChange={(val) => onSettingChange('isForArca', val)}
                  />
                </div>
              </div>
            </div>
          )}

          {/* ═══════════════════════════════════════════════════════════════════
              TAB 5: PLUGIN GLOBAL (플러그인 전역)
              ═══════════════════════════════════════════════════════════════════ */}
          {currentTab === 'plugin' && (
            <div className="mobile-settings-tab-section">
              {/* Plugin UI Theme */}
              <div className="mobile-settings-card">
                <div className="mobile-card-title">
                  <Palette size={15} />
                  <span>플러그인 모달 UI 테마</span>
                </div>
                <div className="mobile-pill-segmented">
                  {[
                    { key: 'dark', label: '다크 모던' },
                    { key: 'classic', label: '클래식 다크' },
                    { key: 'light', label: '라이트' },
                  ].map((t) => {
                    const isSel = (globalSettings.uiTheme || 'dark') === t.key;
                    return (
                      <button
                        key={t.key}
                        type="button"
                        className={`mobile-seg-btn ${isSel ? 'active' : ''}`}
                        onClick={() => onGlobalSettingChange('uiTheme', t.key)}
                      >
                        {t.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Custom CSS */}
              <div className="mobile-settings-card">
                <div className="mobile-card-title">
                  <span>전역 커스텀 스타일 (CSS)</span>
                </div>
                <SettingToggle
                  label="커스텀 CSS 활성화"
                  checked={globalSettings.useCustomStyle ?? false}
                  onChange={(val) => onGlobalSettingChange('useCustomStyle', val)}
                />
                {globalSettings.useCustomStyle && (
                  <textarea
                    rows={4}
                    placeholder="/* 모든 로그에 적용될 전역 CSS */"
                    value={globalSettings.customStyleContent || ''}
                    onChange={(e) =>
                      onGlobalSettingChange('customStyleContent', e.target.value)
                    }
                    className="mobile-textarea"
                  />
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default MobileSettingsDrawer;
