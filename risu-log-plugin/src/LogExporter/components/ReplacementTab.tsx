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

/**
 * Generates a unique identifier for a replacement rule.
 */
const generateRuleId = (): string => {
  return `${Date.now()}-${Math.random().toString(36).substring(2, 8)}`;
};

/**
 * Validates a regular expression pattern and its flags.
 */
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

/**
 * Applies active replacement rules sequentially to an input text string.
 * Uses the exact logic matching the core log processing pipeline.
 */
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
        // Skip invalid regex pattern during execution
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

/**
 * Test preview playground allowing users to test rules against sample input in real time.
 */
interface TestPlaygroundProps {
  rules: ReplacementRule[];
}

const TestPlayground: React.FC<TestPlaygroundProps> = ({ rules }) => {
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
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <FlaskConical size={15} style={{ color: 'var(--primary)' }} />
          <h4 style={{ margin: 0, fontSize: '13px', fontWeight: 600, color: 'var(--foreground)' }}>
            실시간 규칙 테스트 (Playground)
          </h4>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span
            style={{
              fontSize: '11px',
              padding: '2px 7px',
              borderRadius: '9999px',
              backgroundColor: isChanged ? 'rgba(34, 197, 94, 0.15)' : 'var(--muted)',
              color: isChanged ? '#22c55e' : 'var(--muted-foreground)',
              border: `1px solid ${isChanged ? 'rgba(34, 197, 94, 0.3)' : 'var(--border)'}`,
              fontWeight: 500,
            }}
          >
            {activeCount === 0
              ? '활성 규칙 없음'
              : isChanged
              ? '✓ 규칙 적용됨'
              : '변경 사항 없음'}
          </span>
          <Button
            size="small"
            variant="ghost"
            onClick={handleResetSample}
            style={{ fontSize: '11px', height: '24px', padding: '0 8px' }}
            title="예시 텍스트 불러오기"
          >
            <Sparkles size={12} style={{ marginRight: '4px' }} />
            예시
          </Button>
        </div>
      </div>

      <p style={{ margin: 0, fontSize: '11px', color: 'var(--muted-foreground)', lineHeight: 1.4 }}>
        테스트 문장을 입력하여 현재 활성화된 규칙들이 어떻게 적용되는지 실시간으로 확인하세요.
      </p>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
        {/* Input area */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
          <span style={{ fontSize: '11px', fontWeight: 500, color: 'var(--muted-foreground)' }}>
            테스트 입력 ({testInput.length}자)
          </span>
          <textarea
            value={testInput}
            onChange={(e) => setTestInput(e.target.value)}
            placeholder="테스트할 로그 텍스트를 입력하세요..."
            rows={4}
            style={{
              width: '100%',
              boxSizing: 'border-box',
              padding: '8px 10px',
              fontSize: '11px',
              fontFamily: 'monospace',
              lineHeight: 1.4,
              backgroundColor: 'var(--background)',
              color: 'var(--foreground)',
              border: '1px solid var(--border)',
              borderRadius: 'var(--radius)',
              resize: 'vertical',
              outline: 'none',
            }}
          />
        </div>

        {/* Output preview area */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
          <span style={{ fontSize: '11px', fontWeight: 500, color: 'var(--muted-foreground)' }}>
            변환 결과 ({previewOutput.length}자)
          </span>
          <textarea
            readOnly
            value={previewOutput}
            placeholder="결과가 여기에 표시됩니다..."
            rows={4}
            style={{
              width: '100%',
              boxSizing: 'border-box',
              padding: '8px 10px',
              fontSize: '11px',
              fontFamily: 'monospace',
              lineHeight: 1.4,
              backgroundColor: isChanged ? 'rgba(34, 197, 94, 0.04)' : 'var(--background)',
              color: 'var(--foreground)',
              border: `1px solid ${isChanged ? 'rgba(34, 197, 94, 0.4)' : 'var(--border)'}`,
              borderRadius: 'var(--radius)',
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

/**
 * ReplacementTab allows users to create, edit, reorder, and test text and regular expression
 * replacement rules for log exports.
 */
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

  // UI view state
  const [showPlayground, setShowPlayground] = useState(true);

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

  // Total and active count
  const activeCount = useMemo(() => {
    return rules.filter((r) => r.isEnabled !== false).length;
  }, [rules]);

  // --------------------------------------------------------------------------
  // Rule Manipulation Handlers
  // --------------------------------------------------------------------------

  const handleAddRule = useCallback(() => {
    if (!newPattern) return;
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
      if (!editState.pattern) return;
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

  // --------------------------------------------------------------------------
  // Render
  // --------------------------------------------------------------------------

  return (
    <div
      className="tab-content"
      style={{
        padding: '16px',
        display: 'flex',
        flexDirection: 'column',
        gap: '16px',
      }}
    >
      {/* Header card with information & quick actions */}
      <div
        className="shadcn-card"
        style={{
          backgroundColor: 'var(--card)',
          border: '1px solid var(--border)',
          borderRadius: 'var(--radius)',
          padding: '14px 16px',
          display: 'flex',
          flexDirection: 'column',
          gap: '14px',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Replace size={16} style={{ color: 'var(--foreground)' }} />
            <h4 style={{ margin: 0, fontSize: '13px', fontWeight: 600, color: 'var(--foreground)' }}>
              단어 바꾸기 (치환 규칙)
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
              총 {rules.length}개 (활성 {activeCount}개)
            </span>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <Button
              variant="ghost"
              size="small"
              onClick={() => setShowPlayground((prev) => !prev)}
              style={{ fontSize: '11px', height: '26px', padding: '0 8px' }}
              title="테스트 영역 토글"
            >
              <FlaskConical size={13} style={{ marginRight: '4px' }} />
              {showPlayground ? '테스트 닫기' : '테스트 열기'}
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
                  <RefreshCw size={12} style={{ marginRight: '4px' }} />
                  {activeCount === rules.length ? '모두 끄기' : '모두 켜기'}
                </Button>
                <Button
                  variant="ghost"
                  size="small"
                  onClick={handleClearAll}
                  style={{
                    fontSize: '11px',
                    height: '26px',
                    padding: '0 8px',
                    color: 'var(--destructive, #ef4444)',
                  }}
                  title="모든 규칙 삭제"
                >
                  <Trash2 size={12} style={{ marginRight: '4px' }} />
                  전체 삭제
                </Button>
              </>
            )}
          </div>
        </div>

        <p style={{ margin: 0, fontSize: '12px', color: 'var(--muted-foreground)', lineHeight: 1.4 }}>
          로그 내용에서 특정 단어나 정규식 패턴을 찾아 바꿉니다. 규칙은 위에서 아래로 순차적으로
          적용되며, 순서를 위/아래로 이동할 수 있습니다.
        </p>

        {/* New Rule Creation Form */}
        <div
          style={{
            backgroundColor: 'var(--background)',
            border: '1px solid var(--border)',
            borderRadius: 'var(--radius)',
            padding: '12px',
            display: 'flex',
            flexDirection: 'column',
            gap: '10px',
          }}
        >
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            <div style={{ flex: 1, position: 'relative' }}>
              <Input
                placeholder={isRegex ? '찾을 정규식 패턴 (예: <.*?>)' : '찾을 단어 (예: user)'}
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
            <ArrowRight size={14} style={{ color: 'var(--muted-foreground)', flexShrink: 0 }} />
            <div style={{ flex: 1 }}>
              <Input
                placeholder="바꿀 단어 (비워두면 제거)"
                value={newReplacement}
                onChange={(e) => setNewReplacement(e.target.value)}
                onKeyDown={handleNewKeyDown}
                style={{ width: '100%' }}
              />
            </div>
          </div>

          {/* Regex validation warning message */}
          {isRegex && newPattern && !newRuleValidation.isValid && (
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                fontSize: '11px',
                color: 'var(--destructive, #ef4444)',
                padding: '2px 4px',
              }}
            >
              <AlertCircle size={13} style={{ flexShrink: 0 }} />
              <span>정규식 오류: {newRuleValidation.errorMessage}</span>
            </div>
          )}

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <Checkbox checked={isRegex} onChange={(e) => setIsRegex(e.target.checked)}>
                <span style={{ fontSize: '12px', color: 'var(--foreground)' }}>정규식 (Regex)</span>
              </Checkbox>

              {isRegex && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <span style={{ fontSize: '11px', color: 'var(--muted-foreground)' }}>플래그:</span>
                  <Input
                    value={regexFlags}
                    onChange={(e) => setRegexFlags(e.target.value.toLowerCase())}
                    placeholder="g, i, m"
                    style={{ width: '68px', fontFamily: 'monospace' }}
                    size="small"
                  />
                  <span
                    style={{
                      fontSize: '10px',
                      color: 'var(--muted-foreground)',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '2px',
                    }}
                    title="g: 전체 일치, i: 대소문자 무시, m: 여러 줄 일치, s: 점이 줄바꿈 포함"
                  >
                    <HelpCircle size={11} />
                    g, i, m, s
                  </span>
                </div>
              )}
            </div>

            <Button
              type="primary"
              icon={<Plus size={14} />}
              onClick={handleAddRule}
              disabled={!newPattern || (isRegex && !newRuleValidation.isValid)}
              size="small"
            >
              추가
            </Button>
          </div>
        </div>

        {/* Rule List Container */}
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            border: '1px solid var(--border)',
            borderRadius: 'var(--radius)',
            overflow: 'hidden',
            backgroundColor: 'var(--background)',
          }}
        >
          {rules.length === 0 ? (
            <div
              style={{
                padding: '28px 16px',
                textAlign: 'center',
                color: 'var(--muted-foreground)',
                fontSize: '12px',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: '6px',
              }}
            >
              <Replace size={24} style={{ opacity: 0.4 }} />
              <span>등록된 치환 규칙이 없습니다.</span>
              <span style={{ fontSize: '11px', opacity: 0.7 }}>
                상단에서 찾을 단어와 바꿀 단어를 입력하여 규칙을 추가해보세요.
              </span>
            </div>
          ) : (
            rules.map((rule, idx) => {
              const isEditing = editingId === rule.id;
              const isEnabled = rule.isEnabled !== false;

              // Validate regex for display badge
              const ruleRegexValid =
                rule.isRegex && rule.pattern ? validateRegex(rule.pattern, rule.flags || 'g').isValid : true;

              if (isEditing) {
                return (
                  <div
                    key={rule.id}
                    style={{
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '8px',
                      padding: '10px 12px',
                      backgroundColor: 'var(--muted)',
                      borderBottom: idx < rules.length - 1 ? '1px solid var(--border)' : 'none',
                    }}
                  >
                    <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                      <span style={{ fontSize: '11px', fontWeight: 600, color: 'var(--primary)', width: '24px' }}>
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
                      <ArrowRight size={13} style={{ color: 'var(--muted-foreground)', flexShrink: 0 }} />
                      <Input
                        value={editState.replacement}
                        onChange={(e) => setEditState({ ...editState, replacement: e.target.value })}
                        onKeyDown={(e) => handleEditKeyDown(e, rule.id)}
                        placeholder="바꿀 단어 (비워두면 제거)"
                        style={{ flex: 1 }}
                        size="small"
                      />
                    </div>

                    {editState.isRegex && editState.pattern && !editRuleValidation.isValid && (
                      <div
                        style={{
                          fontSize: '11px',
                          color: 'var(--destructive, #ef4444)',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '4px',
                          paddingLeft: '32px',
                        }}
                      >
                        <AlertCircle size={12} />
                        <span>정규식 오류: {editRuleValidation.errorMessage}</span>
                      </div>
                    )}

                    <div
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        paddingLeft: '32px',
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
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
                            style={{ width: '60px', fontFamily: 'monospace' }}
                            size="small"
                          />
                        )}
                      </div>

                      <div style={{ display: 'flex', gap: '6px' }}>
                        <Button
                          size="small"
                          variant="ghost"
                          onClick={handleCancelEdit}
                          style={{ height: '24px', padding: '0 8px', fontSize: '11px' }}
                        >
                          <X size={12} style={{ marginRight: '4px' }} />
                          취소
                        </Button>
                        <Button
                          size="small"
                          type="primary"
                          onClick={() => handleSaveEdit(rule.id)}
                          disabled={!editState.pattern || (editState.isRegex && !editRuleValidation.isValid)}
                          style={{ height: '24px', padding: '0 8px', fontSize: '11px' }}
                        >
                          <Check size={12} style={{ marginRight: '4px' }} />
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
                    padding: '8px 12px',
                    borderBottom: idx < rules.length - 1 ? '1px solid var(--border)' : 'none',
                    opacity: isEnabled ? 1 : 0.5,
                    fontSize: '12px',
                    transition: 'opacity 0.15s ease, background-color 0.15s ease',
                  }}
                >
                  {/* Order Index & Enable Switch */}
                  <span
                    style={{
                      fontSize: '11px',
                      color: 'var(--muted-foreground)',
                      fontFamily: 'monospace',
                      minWidth: '20px',
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

                  {/* Pattern and Replacement Display */}
                  <div
                    style={{
                      flex: 1,
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px',
                      overflow: 'hidden',
                      minWidth: 0,
                    }}
                  >
                    <span
                      style={{
                        fontFamily: 'monospace',
                        backgroundColor: 'var(--muted)',
                        padding: '2px 6px',
                        borderRadius: '4px',
                        border: '1px solid var(--border)',
                        maxWidth: '140px',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                        color: 'var(--foreground)',
                      }}
                      title={rule.pattern}
                    >
                      {rule.pattern}
                    </span>

                    <ArrowRight size={12} style={{ color: 'var(--muted-foreground)', flexShrink: 0 }} />

                    <span
                      style={{
                        fontFamily: 'monospace',
                        backgroundColor: 'var(--muted)',
                        padding: '2px 6px',
                        borderRadius: '4px',
                        border: '1px solid var(--border)',
                        maxWidth: '140px',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                        color: rule.replacement ? 'var(--foreground)' : 'var(--muted-foreground)',
                        fontStyle: rule.replacement ? 'normal' : 'italic',
                      }}
                      title={rule.replacement || '(빈 문자열로 치환)'}
                    >
                      {rule.replacement || '(삭제)'}
                    </span>

                    {/* Regex Badge */}
                    {rule.isRegex && (
                      <span
                        style={{
                          fontSize: '10px',
                          padding: '1px 6px',
                          borderRadius: '4px',
                          backgroundColor: ruleRegexValid
                            ? 'rgba(168, 85, 247, 0.15)'
                            : 'rgba(239, 68, 68, 0.15)',
                          color: ruleRegexValid ? '#a855f7' : '#ef4444',
                          border: `1px solid ${
                            ruleRegexValid ? 'rgba(168, 85, 247, 0.3)' : 'rgba(239, 68, 68, 0.3)'
                          }`,
                          fontWeight: 500,
                          flexShrink: 0,
                        }}
                        title={
                          ruleRegexValid
                            ? `정규식 모드 (플래그: /${rule.flags || 'g'})`
                            : '정규식 문법 오류'
                        }
                      >
                        {ruleRegexValid ? `Regex /${rule.flags || 'g'}` : 'Regex 오류'}
                      </span>
                    )}
                  </div>

                  {/* Actions (Reorder, Edit, Duplicate, Delete) */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '2px', flexShrink: 0 }}>
                    <button
                      type="button"
                      disabled={idx === 0}
                      onClick={() => handleMoveRule(idx, 'up')}
                      style={{
                        border: 'none',
                        background: 'transparent',
                        color: idx === 0 ? 'var(--muted-foreground)' : 'var(--foreground)',
                        opacity: idx === 0 ? 0.3 : 0.7,
                        cursor: idx === 0 ? 'default' : 'pointer',
                        padding: '4px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        borderRadius: '4px',
                      }}
                      title="위로 이동"
                    >
                      <ChevronUp size={14} />
                    </button>

                    <button
                      type="button"
                      disabled={idx === rules.length - 1}
                      onClick={() => handleMoveRule(idx, 'down')}
                      style={{
                        border: 'none',
                        background: 'transparent',
                        color: idx === rules.length - 1 ? 'var(--muted-foreground)' : 'var(--foreground)',
                        opacity: idx === rules.length - 1 ? 0.3 : 0.7,
                        cursor: idx === rules.length - 1 ? 'default' : 'pointer',
                        padding: '4px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        borderRadius: '4px',
                      }}
                      title="아래로 이동"
                    >
                      <ChevronDown size={14} />
                    </button>

                    <button
                      type="button"
                      onClick={() => handleStartEdit(rule)}
                      style={{
                        border: 'none',
                        background: 'transparent',
                        color: 'var(--foreground)',
                        opacity: 0.7,
                        cursor: 'pointer',
                        padding: '4px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        borderRadius: '4px',
                      }}
                      title="규칙 수정"
                    >
                      <Pencil size={13} />
                    </button>

                    <button
                      type="button"
                      onClick={() => handleDuplicateRule(idx)}
                      style={{
                        border: 'none',
                        background: 'transparent',
                        color: 'var(--foreground)',
                        opacity: 0.7,
                        cursor: 'pointer',
                        padding: '4px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        borderRadius: '4px',
                      }}
                      title="규칙 복제"
                    >
                      <Copy size={13} />
                    </button>

                    <button
                      type="button"
                      onClick={() => handleDeleteRule(rule.id)}
                      style={{
                        border: 'none',
                        background: 'transparent',
                        color: 'var(--destructive, #ef4444)',
                        cursor: 'pointer',
                        padding: '4px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        borderRadius: '4px',
                      }}
                      title="규칙 삭제"
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* Test Playground Card */}
      {showPlayground && <TestPlayground rules={rules} />}
    </div>
  );
};

export default ReplacementTab;