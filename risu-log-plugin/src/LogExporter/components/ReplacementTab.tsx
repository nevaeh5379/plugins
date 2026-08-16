import React, { useState, useMemo, useCallback } from 'react';
import type { ReplacementRule } from '../../types';
import { Input, Checkbox, Button, Switch } from '../../components/ui';
import {
  Replace,
  ArrowRight,
  Plus,
  Trash2,
  Pencil,
  Check,
  X,
  ChevronUp,
  ChevronDown,
  Copy,
  FlaskConical,
  AlertCircle,
  Sparkles,
  HelpCircle,
  RefreshCw,
} from 'lucide-react';

// ============================================================================
// Types & Interfaces
// ============================================================================

export interface ReplacementTabProps {
  /** List of current replacement rules */
  rules: ReplacementRule[];
  /** Callback fired whenever rules are modified */
  onRulesChange: (rules: ReplacementRule[]) => void;
}

interface RegexValidationResult {
  isValid: boolean;
  errorMessage?: string;
}

interface EditRuleState {
  pattern: string;
  replacement: string;
  isRegex: boolean;
  flags: string;
}

// ============================================================================
// Helper Functions
// ============================================================================

const generateRuleId = (): string => {
  return `${Date.now()}-${Math.random().toString(36).substring(2, 8)}`;
};

const validateRegex = (pattern: string, flags = 'g'): RegexValidationResult => {
  if (!pattern) {
    return { isValid: false, errorMessage: '패턴을 입력해주세요.' };
  }
  try {
    new RegExp(pattern, flags);
    return { isValid: true };
  } catch (err) {
    const message = err instanceof Error ? err.message : '유효하지 않은 정규식입니다.';
    return { isValid: false, errorMessage: message };
  }
};

const applyRulesToText = (text: string, rules: ReplacementRule[]): string => {
  if (!text || !rules || rules.length === 0) return text;

  let currentText = text;

  for (const rule of rules) {
    if (rule.isEnabled === false || !rule.pattern) continue;

    if (rule.isRegex) {
      try {
        const regex = new RegExp(rule.pattern, rule.flags || 'g');
        currentText = currentText.replace(regex, rule.replacement ?? '');
      } catch {
        // Skip invalid regex pattern
      }
    } else {
      currentText = currentText.split(rule.pattern).join(rule.replacement ?? '');
    }
  }

  return currentText;
};

// ============================================================================
// Sub-components
// ============================================================================

interface TestPlaygroundProps {
  rules: ReplacementRule[];
  onClose: () => void;
}

const TestPlayground: React.FC<TestPlaygroundProps> = ({ rules, onClose }) => {
  const [testInput, setTestInput] = useState<string>(
    'User: 안녕하세요! <font color="red">반갑습니다.</font>\nAssistant: 안녕하세요! 무엇을 도와드릴까요?'
  );

  const previewOutput = useMemo(() => {
    return applyRulesToText(testInput, rules);
  }, [testInput, rules]);

  const isChanged = testInput !== previewOutput;
  const activeCount = rules.filter((r) => r.isEnabled !== false && Boolean(r.pattern)).length;

  const handleResetSample = () => {
    setTestInput(
      'User: 안녕하세요! <font color="red">반갑습니다.</font>\nAssistant: 안녕하세요! 무엇을 도와드릴까요?'
    );
  };

  return (
    <div
      className="shadcn-card"
      style={{
        backgroundColor: 'var(--card)',
        border: '1px solid var(--border)',
        borderRadius: 'var(--radius)',
        padding: '12px 14px',
        display: 'flex',
        flexDirection: 'column',
        gap: '10px',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <FlaskConical size={15} style={{ color: 'var(--foreground)' }} />
          <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--foreground)' }}>
            실시간 규칙 테스트
          </span>
          <span
            style={{
              fontSize: '10px',
              padding: '1px 6px',
              borderRadius: '9999px',
              backgroundColor: isChanged ? 'rgba(34, 197, 94, 0.12)' : 'var(--muted)',
              color: isChanged ? '#22c55e' : 'var(--muted-foreground)',
              border: `1px solid ${isChanged ? 'rgba(34, 197, 94, 0.25)' : 'var(--border)'}`,
              fontWeight: 500,
            }}
          >
            {activeCount === 0
              ? '활성 규칙 없음'
              : isChanged
              ? '규칙 적용됨'
              : '일치 항목 없음'}
          </span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
          <Button
            size="small"
            variant="ghost"
            onClick={handleResetSample}
            style={{ fontSize: '11px', height: '24px', padding: '0 6px' }}
            title="예시 문장 불러오기"
          >
            <Sparkles size={11} style={{ marginRight: '3px' }} />
            예시
          </Button>
          <Button
            size="small"
            variant="ghost"
            onClick={onClose}
            style={{ height: '24px', width: '24px', padding: 0 }}
            title="테스트 창 닫기"
          >
            <X size={13} />
          </Button>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
        {/* Input area */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '10px', fontWeight: 500, color: 'var(--muted-foreground)' }}>
              입력 텍스트
            </span>
            <span style={{ fontSize: '10px', color: 'var(--muted-foreground)' }}>
              {testInput.length}자
            </span>
          </div>
          <textarea
            value={testInput}
            onChange={(e) => setTestInput(e.target.value)}
            placeholder="테스트할 문장 입력..."
            rows={3}
            style={{
              width: '100%',
              boxSizing: 'border-box',
              padding: '6px 8px',
              fontSize: '11px',
              fontFamily: 'monospace',
              lineHeight: 1.4,
              backgroundColor: 'var(--background)',
              color: 'var(--foreground)',
              border: '1px solid var(--border)',
              borderRadius: 'calc(var(--radius) - 2px)',
              resize: 'vertical',
              outline: 'none',
            }}
          />
        </div>

        {/* Output preview area */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '10px', fontWeight: 500, color: 'var(--muted-foreground)' }}>
              변환 결과
            </span>
            <span style={{ fontSize: '10px', color: 'var(--muted-foreground)' }}>
              {previewOutput.length}자
            </span>
          </div>
          <textarea
            readOnly
            value={previewOutput}
            placeholder="치환 결과..."
            rows={3}
            style={{
              width: '100%',
              boxSizing: 'border-box',
              padding: '6px 8px',
              fontSize: '11px',
              fontFamily: 'monospace',
              lineHeight: 1.4,
              backgroundColor: 'var(--background)',
              color: 'var(--foreground)',
              border: `1px solid ${isChanged ? 'rgba(34, 197, 94, 0.3)' : 'var(--border)'}`,
              borderRadius: 'calc(var(--radius) - 2px)',
              resize: 'vertical',
              outline: 'none',
            }}
          />
        </div>
      </div>
    </div>
  );
};

// ============================================================================
// Main Component
// ============================================================================

export const ReplacementTab: React.FC<ReplacementTabProps> = ({ rules = [], onRulesChange }) => {
  // New rule creation state
  const [newPattern, setNewPattern] = useState('');
  const [newReplacement, setNewReplacement] = useState('');
  const [isRegex, setIsRegex] = useState(false);
  const [regexFlags, setRegexFlags] = useState('g');

  // Inline editing state
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editState, setEditState] = useState<EditRuleState>({
    pattern: '',
    replacement: '',
    isRegex: false,
    flags: 'g',
  });

  // UI view state - default closed for clean initial view
  const [showPlayground, setShowPlayground] = useState(false);

  // Validation for new rule
  const newRuleValidation = useMemo(() => {
    if (!isRegex || !newPattern) return { isValid: true };
    return validateRegex(newPattern, regexFlags);
  }, [newPattern, isRegex, regexFlags]);

  // Validation for currently editing rule
  const editRuleValidation = useMemo(() => {
    if (!editState.isRegex || !editState.pattern) return { isValid: true };
    return validateRegex(editState.pattern, editState.flags);
  }, [editState.pattern, editState.isRegex, editState.flags]);

  // Active count
  const activeCount = useMemo(() => {
    return rules.filter((r) => r.isEnabled !== false).length;
  }, [rules]);

  // Handlers
  const handleAddRule = useCallback(() => {
    if (!newPattern.trim()) return;
    if (isRegex && !newRuleValidation.isValid) return;

    const newRule: ReplacementRule = {
      id: generateRuleId(),
      pattern: newPattern,
      replacement: newReplacement,
      isRegex,
      flags: isRegex ? regexFlags || 'g' : undefined,
      isEnabled: true,
    };

    onRulesChange([...rules, newRule]);
    setNewPattern('');
    setNewReplacement('');
  }, [newPattern, newReplacement, isRegex, regexFlags, newRuleValidation.isValid, rules, onRulesChange]);

  const handleDeleteRule = useCallback(
    (id: string) => {
      onRulesChange(rules.filter((r) => r.id !== id));
      if (editingId === id) {
        setEditingId(null);
      }
    },
    [rules, onRulesChange, editingId]
  );

  const handleToggleRule = useCallback(
    (id: string) => {
      onRulesChange(
        rules.map((r) => (r.id === id ? { ...r, isEnabled: r.isEnabled === false } : r))
      );
    },
    [rules, onRulesChange]
  );

  const handleMoveRule = useCallback(
    (index: number, direction: 'up' | 'down') => {
      const targetIndex = direction === 'up' ? index - 1 : index + 1;
      if (targetIndex < 0 || targetIndex >= rules.length) return;

      const newRules = [...rules];
      const [movedItem] = newRules.splice(index, 1);
      newRules.splice(targetIndex, 0, movedItem);
      onRulesChange(newRules);
    },
    [rules, onRulesChange]
  );

  const handleDuplicateRule = useCallback(
    (index: number) => {
      const target = rules[index];
      if (!target) return;

      const duplicated: ReplacementRule = {
        ...target,
        id: generateRuleId(),
      };

      const newRules = [...rules];
      newRules.splice(index + 1, 0, duplicated);
      onRulesChange(newRules);
    },
    [rules, onRulesChange]
  );

  const handleStartEdit = useCallback((rule: ReplacementRule) => {
    setEditingId(rule.id);
    setEditState({
      pattern: rule.pattern,
      replacement: rule.replacement ?? '',
      isRegex: Boolean(rule.isRegex),
      flags: rule.flags || 'g',
    });
  }, []);

  const handleCancelEdit = useCallback(() => {
    setEditingId(null);
  }, []);

  const handleSaveEdit = useCallback(
    (id: string) => {
      if (!editState.pattern.trim()) return;
      if (editState.isRegex && !editRuleValidation.isValid) return;

      onRulesChange(
        rules.map((r) =>
          r.id === id
            ? {
                ...r,
                pattern: editState.pattern,
                replacement: editState.replacement,
                isRegex: editState.isRegex,
                flags: editState.isRegex ? editState.flags || 'g' : undefined,
              }
            : r
        )
      );
      setEditingId(null);
    },
    [editState, editRuleValidation.isValid, rules, onRulesChange]
  );

  const handleToggleAll = useCallback(() => {
    const allEnabled = rules.every((r) => r.isEnabled !== false);
    onRulesChange(rules.map((r) => ({ ...r, isEnabled: !allEnabled })));
  }, [rules, onRulesChange]);

  const handleClearAll = useCallback(() => {
    if (rules.length === 0) return;
    if (window.confirm('등록된 모든 치환 규칙을 삭제하시겠습니까?')) {
      onRulesChange([]);
      setEditingId(null);
    }
  }, [rules.length, onRulesChange]);

  const handleNewKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      handleAddRule();
    }
  };

  const handleEditKeyDown = (e: React.KeyboardEvent<HTMLInputElement>, id: string) => {
    if (e.key === 'Enter') {
      handleSaveEdit(id);
    } else if (e.key === 'Escape') {
      handleCancelEdit();
    }
  };

  return (
    <div
      className="tab-content"
      style={{
        padding: '16px',
        display: 'flex',
        flexDirection: 'column',
        gap: '14px',
      }}
    >
      {/* ── Main Replacement Rules Card ── */}
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
        {/* Header Bar */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Replace size={16} style={{ color: 'var(--foreground)' }} />
            <h4 style={{ margin: 0, fontSize: '13px', fontWeight: 600, color: 'var(--foreground)' }}>
              단어 치환 규칙
            </h4>
            <span
              style={{
                fontSize: '11px',
                padding: '1px 6px',
                borderRadius: '9999px',
                backgroundColor: 'var(--muted)',
                color: 'var(--muted-foreground)',
                fontWeight: 500,
              }}
            >
              {rules.length > 0 ? `${activeCount}/${rules.length}개 활성` : '0개'}
            </span>
            <span
              title="규칙은 위에서 아래로 순차 적용됩니다."
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                color: 'var(--muted-foreground)',
                cursor: 'help',
              }}
            >
              <HelpCircle size={13} />
            </span>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
            <Button
              variant="ghost"
              size="small"
              onClick={() => setShowPlayground((prev) => !prev)}
              style={{
                fontSize: '11px',
                height: '26px',
                padding: '0 8px',
                backgroundColor: showPlayground ? 'var(--secondary)' : 'transparent',
              }}
              title="실시간 테스트 영역 열기/닫기"
            >
              <FlaskConical size={12} style={{ marginRight: '4px' }} />
              {showPlayground ? '테스트 닫기' : '테스트'}
            </Button>

            {rules.length > 0 && (
              <>
                <Button
                  variant="ghost"
                  size="small"
                  onClick={handleToggleAll}
                  style={{ fontSize: '11px', height: '26px', padding: '0 8px' }}
                  title="모든 규칙 일괄 켜기 / 끄기"
                >
                  <RefreshCw size={11} style={{ marginRight: '4px' }} />
                  {activeCount === rules.length ? '모두 끄기' : '모두 켜기'}
                </Button>
                <Button
                  variant="ghost"
                  size="small"
                  onClick={handleClearAll}
                  style={{
                    fontSize: '11px',
                    height: '26px',
                    padding: '0 6px',
                    color: 'var(--destructive, #ef4444)',
                  }}
                  title="모든 규칙 삭제"
                >
                  <Trash2 size={12} />
                </Button>
              </>
            )}
          </div>
        </div>

        {/* Compact Add Rule Bar */}
        <div
          style={{
            backgroundColor: 'var(--muted)',
            border: '1px solid var(--border)',
            borderRadius: 'calc(var(--radius) - 2px)',
            padding: '8px 10px',
            display: 'flex',
            flexDirection: 'column',
            gap: '8px',
          }}
        >
          <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
            <div style={{ flex: 1 }}>
              <Input
                size="small"
                placeholder={isRegex ? '찾을 정규식 (예: <.*?>)' : '찾을 단어 (예: user)'}
                value={newPattern}
                onChange={(e) => setNewPattern(e.target.value)}
                onKeyDown={handleNewKeyDown}
                style={{
                  width: '100%',
                  borderColor:
                    isRegex && newPattern && !newRuleValidation.isValid
                      ? 'var(--destructive, #ef4444)'
                      : undefined,
                }}
              />
            </div>
            <ArrowRight size={13} style={{ color: 'var(--muted-foreground)', flexShrink: 0 }} />
            <div style={{ flex: 1 }}>
              <Input
                size="small"
                placeholder="바꿀 단어 (비워두면 삭제)"
                value={newReplacement}
                onChange={(e) => setNewReplacement(e.target.value)}
                onKeyDown={handleNewKeyDown}
                style={{ width: '100%' }}
              />
            </div>
            <Button
              type="primary"
              size="small"
              icon={<Plus size={13} />}
              onClick={handleAddRule}
              disabled={!newPattern.trim() || (isRegex && !newRuleValidation.isValid)}
              style={{ flexShrink: 0, height: '28px', padding: '0 10px' }}
            >
              추가
            </Button>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <Checkbox checked={isRegex} onChange={(e) => setIsRegex(e.target.checked)}>
                <span style={{ fontSize: '11px', color: 'var(--foreground)' }}>정규식 (Regex)</span>
              </Checkbox>

              {isRegex && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <span style={{ fontSize: '10px', color: 'var(--muted-foreground)' }}>플래그:</span>
                  <Input
                    value={regexFlags}
                    onChange={(e) => setRegexFlags(e.target.value.toLowerCase())}
                    placeholder="g, i, m"
                    style={{ width: '56px', fontFamily: 'monospace', height: '22px', fontSize: '10px', padding: '0 4px' }}
                  />
                </div>
              )}
            </div>

            {isRegex && newPattern && !newRuleValidation.isValid && (
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px',
                  fontSize: '10px',
                  color: 'var(--destructive, #ef4444)',
                }}
              >
                <AlertCircle size={11} />
                <span>{newRuleValidation.errorMessage}</span>
              </div>
            )}
          </div>
        </div>

        {/* Rule List Container */}
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            border: '1px solid var(--border)',
            borderRadius: 'calc(var(--radius) - 2px)',
            overflow: 'hidden',
            backgroundColor: 'var(--background)',
          }}
        >
          {rules.length === 0 ? (
            <div
              style={{
                padding: '24px 16px',
                textAlign: 'center',
                color: 'var(--muted-foreground)',
                fontSize: '12px',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: '4px',
              }}
            >
              <Replace size={20} style={{ opacity: 0.35, marginBottom: '2px' }} />
              <span style={{ fontWeight: 500 }}>등록된 치환 규칙이 없습니다</span>
              <span style={{ fontSize: '11px', opacity: 0.7 }}>
                상단 입력창에서 단어를 입력하여 규칙을 추가하세요
              </span>
            </div>
          ) : (
            rules.map((rule, idx) => {
              const isEditing = editingId === rule.id;
              const isEnabled = rule.isEnabled !== false;

              if (isEditing) {
                return (
                  <div
                    key={rule.id}
                    style={{
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '6px',
                      padding: '8px 10px',
                      backgroundColor: 'var(--muted)',
                      borderBottom: idx < rules.length - 1 ? '1px solid var(--border)' : 'none',
                    }}
                  >
                    <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                      <span style={{ fontSize: '11px', fontWeight: 600, color: 'var(--muted-foreground)', width: '22px' }}>
                        #{idx + 1}
                      </span>
                      <Input
                        value={editState.pattern}
                        onChange={(e) => setEditState({ ...editState, pattern: e.target.value })}
                        onKeyDown={(e) => handleEditKeyDown(e, rule.id)}
                        placeholder="찾을 패턴"
                        style={{
                          flex: 1,
                          borderColor:
                            editState.isRegex && editState.pattern && !editRuleValidation.isValid
                              ? 'var(--destructive, #ef4444)'
                              : undefined,
                        }}
                        size="small"
                        autoFocus
                      />
                      <ArrowRight size={12} style={{ color: 'var(--muted-foreground)', flexShrink: 0 }} />
                      <Input
                        value={editState.replacement}
                        onChange={(e) => setEditState({ ...editState, replacement: e.target.value })}
                        onKeyDown={(e) => handleEditKeyDown(e, rule.id)}
                        placeholder="바꿀 단어 (비워두면 삭제)"
                        style={{ flex: 1 }}
                        size="small"
                      />
                    </div>

                    <div
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        paddingLeft: '28px',
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <Checkbox
                          checked={editState.isRegex}
                          onChange={(e) => setEditState({ ...editState, isRegex: e.target.checked })}
                        >
                          <span style={{ fontSize: '11px', color: 'var(--foreground)' }}>정규식</span>
                        </Checkbox>
                        {editState.isRegex && (
                          <Input
                            value={editState.flags}
                            onChange={(e) =>
                              setEditState({ ...editState, flags: e.target.value.toLowerCase() })
                            }
                            placeholder="g, i, m"
                            style={{ width: '50px', fontFamily: 'monospace', height: '22px', fontSize: '10px', padding: '0 4px' }}
                          />
                        )}
                      </div>

                      <div style={{ display: 'flex', gap: '4px' }}>
                        <Button
                          size="small"
                          variant="ghost"
                          onClick={handleCancelEdit}
                          style={{ height: '24px', padding: '0 6px', fontSize: '11px' }}
                        >
                          <X size={11} style={{ marginRight: '3px' }} />
                          취소
                        </Button>
                        <Button
                          size="small"
                          type="primary"
                          onClick={() => handleSaveEdit(rule.id)}
                          disabled={!editState.pattern.trim() || (editState.isRegex && !editRuleValidation.isValid)}
                          style={{ height: '24px', padding: '0 8px', fontSize: '11px' }}
                        >
                          <Check size={11} style={{ marginRight: '3px' }} />
                          저장
                        </Button>
                      </div>
                    </div>
                  </div>
                );
              }

              return (
                <div
                  key={rule.id}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    padding: '6px 10px',
                    borderBottom: idx < rules.length - 1 ? '1px solid var(--border)' : 'none',
                    opacity: isEnabled ? 1 : 0.45,
                    fontSize: '12px',
                    transition: 'opacity 0.15s ease',
                  }}
                >
                  <span
                    style={{
                      fontSize: '10px',
                      color: 'var(--muted-foreground)',
                      fontFamily: 'monospace',
                      minWidth: '18px',
                    }}
                  >
                    #{idx + 1}
                  </span>

                  <Switch
                    checked={isEnabled}
                    onChange={() => handleToggleRule(rule.id)}
                    size="small"
                    title={isEnabled ? '규칙 비활성화' : '규칙 활성화'}
                  />

                  {/* Pattern and Replacement Flow */}
                  <div
                    style={{
                      flex: 1,
                      display: 'flex',
                      alignItems: 'center',
                      gap: '5px',
                      overflow: 'hidden',
                      minWidth: 0,
                    }}
                  >
                    <span
                      style={{
                        fontFamily: 'monospace',
                        backgroundColor: 'var(--muted)',
                        padding: '1px 5px',
                        borderRadius: '3px',
                        border: '1px solid var(--border)',
                        maxWidth: '130px',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                        color: 'var(--foreground)',
                        fontSize: '11px',
                      }}
                      title={rule.pattern}
                    >
                      {rule.pattern}
                    </span>

                    {rule.isRegex && (
                      <span
                        style={{
                          fontSize: '9px',
                          padding: '0 4px',
                          borderRadius: '3px',
                          backgroundColor: 'var(--muted)',
                          color: 'var(--muted-foreground)',
                          border: '1px solid var(--border)',
                          fontWeight: 500,
                          flexShrink: 0,
                          fontFamily: 'monospace',
                        }}
                        title={`정규식 플래그: /${rule.flags || 'g'}`}
                      >
                        /{rule.flags || 'g'}
                      </span>
                    )}

                    <ArrowRight size={11} style={{ color: 'var(--muted-foreground)', flexShrink: 0 }} />

                    <span
                      style={{
                        fontFamily: 'monospace',
                        backgroundColor: 'var(--muted)',
                        padding: '1px 5px',
                        borderRadius: '3px',
                        border: '1px solid var(--border)',
                        maxWidth: '130px',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                        color: rule.replacement ? 'var(--foreground)' : 'var(--muted-foreground)',
                        fontStyle: rule.replacement ? 'normal' : 'italic',
                        fontSize: '11px',
                      }}
                      title={rule.replacement || '(빈 문자열로 삭제)'}
                    >
                      {rule.replacement || '(삭제)'}
                    </span>
                  </div>

                  {/* Quick Actions (Move, Edit, Duplicate, Delete) */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '1px', flexShrink: 0 }}>
                    <button
                      type="button"
                      disabled={idx === 0}
                      onClick={() => handleMoveRule(idx, 'up')}
                      style={{
                        border: 'none',
                        background: 'transparent',
                        color: 'var(--muted-foreground)',
                        opacity: idx === 0 ? 0.25 : 0.8,
                        cursor: idx === 0 ? 'default' : 'pointer',
                        padding: '3px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        borderRadius: '3px',
                      }}
                      title="위로 이동"
                    >
                      <ChevronUp size={13} />
                    </button>

                    <button
                      type="button"
                      disabled={idx === rules.length - 1}
                      onClick={() => handleMoveRule(idx, 'down')}
                      style={{
                        border: 'none',
                        background: 'transparent',
                        color: 'var(--muted-foreground)',
                        opacity: idx === rules.length - 1 ? 0.25 : 0.8,
                        cursor: idx === rules.length - 1 ? 'default' : 'pointer',
                        padding: '3px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        borderRadius: '3px',
                      }}
                      title="아래로 이동"
                    >
                      <ChevronDown size={13} />
                    </button>

                    <button
                      type="button"
                      onClick={() => handleStartEdit(rule)}
                      style={{
                        border: 'none',
                        background: 'transparent',
                        color: 'var(--muted-foreground)',
                        opacity: 0.8,
                        cursor: 'pointer',
                        padding: '3px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        borderRadius: '3px',
                      }}
                      title="수정"
                    >
                      <Pencil size={12} />
                    </button>

                    <button
                      type="button"
                      onClick={() => handleDuplicateRule(idx)}
                      style={{
                        border: 'none',
                        background: 'transparent',
                        color: 'var(--muted-foreground)',
                        opacity: 0.8,
                        cursor: 'pointer',
                        padding: '3px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        borderRadius: '3px',
                      }}
                      title="복제"
                    >
                      <Copy size={12} />
                    </button>

                    <button
                      type="button"
                      onClick={() => handleDeleteRule(rule.id)}
                      style={{
                        border: 'none',
                        background: 'transparent',
                        color: 'var(--destructive, #ef4444)',
                        opacity: 0.8,
                        cursor: 'pointer',
                        padding: '3px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        borderRadius: '3px',
                      }}
                      title="삭제"
                    >
                      <Trash2 size={12} />
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* ── Test Playground Collapsible Card ── */}
      {showPlayground && <TestPlayground rules={rules} onClose={() => setShowPlayground(false)} />}
    </div>
  );
};

export default ReplacementTab;