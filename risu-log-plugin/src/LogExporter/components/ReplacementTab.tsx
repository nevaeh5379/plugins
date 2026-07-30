import React, { useState } from 'react';
import type { ReplacementRule } from '../../types';
import { Input, Checkbox, Button, Switch } from 'antd';
import { Replace, ArrowRight, Plus, Trash2 } from 'lucide-react';

interface ReplacementTabProps {
  rules: ReplacementRule[];
  onRulesChange: (rules: ReplacementRule[]) => void;
}

const ReplacementTab: React.FC<ReplacementTabProps> = ({ rules, onRulesChange }) => {
  const [newPattern, setNewPattern] = useState('');
  const [newReplacement, setNewReplacement] = useState('');
  const [isRegex, setIsRegex] = useState(false);
  const [regexFlags, setRegexFlags] = useState('g');

  const handleAddRule = () => {
    if (!newPattern) return;
    const newRule: ReplacementRule = {
      id: Date.now().toString(),
      pattern: newPattern,
      replacement: newReplacement,
      isRegex,
      flags: isRegex ? regexFlags : undefined,
      isEnabled: true
    };
    onRulesChange([...rules, newRule]);
    setNewPattern('');
    setNewReplacement('');
  };

  const handleDeleteRule = (id: string) => {
    onRulesChange(rules.filter(r => r.id !== id));
  };

  const handleToggleRule = (id: string) => {
    onRulesChange(rules.map(r => r.id === id ? { ...r, isEnabled: !r.isEnabled } : r));
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleAddRule();
    }
  };

  return (
    <div className="tab-content" style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
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
          <Replace size={16} style={{ color: 'var(--foreground)' }} />
          <h4 style={{ margin: 0, fontSize: '13px', fontWeight: 600, color: 'var(--foreground)' }}>단어 바꾸기</h4>
        </div>
        <p style={{ margin: 0, fontSize: '12px', color: 'var(--muted-foreground)', lineHeight: 1.4 }}>
          로그 내용에서 특정 단어를 찾아 바꿉니다. 규칙은 위에서 아래로 순차적으로 적용됩니다.
        </p>

        {/* 규칙 추가 영역 */}
        <div style={{
          backgroundColor: 'var(--background)',
          border: '1px solid var(--border)',
          borderRadius: 'var(--radius)',
          padding: '12px',
          display: 'flex',
          flexDirection: 'column',
          gap: '10px',
        }}>
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            <Input
              placeholder="찾을 단어"
              value={newPattern}
              onChange={(e) => setNewPattern(e.target.value)}
              onKeyDown={handleKeyDown}
              style={{ flex: 1 }}
            />
            <ArrowRight size={14} style={{ color: 'var(--muted-foreground)', flexShrink: 0 }} />
            <Input
              placeholder="바꿀 단어"
              value={newReplacement}
              onChange={(e) => setNewReplacement(e.target.value)}
              onKeyDown={handleKeyDown}
              style={{ flex: 1 }}
            />
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <Checkbox
                checked={isRegex}
                onChange={e => setIsRegex(e.target.checked)}
              >
                <span style={{ fontSize: '12px', color: 'var(--foreground)' }}>정규식 (Regex)</span>
              </Checkbox>
              {isRegex && (
                <Input
                  value={regexFlags}
                  onChange={e => setRegexFlags(e.target.value)}
                  placeholder="g, i, m"
                  style={{ width: '80px' }}
                  size="small"
                />
              )}
            </div>
            <Button
              type="primary"
              icon={<Plus size={14} />}
              onClick={handleAddRule}
              disabled={!newPattern}
              size="small"
            >
              추가
            </Button>
          </div>
        </div>

        {/* 규칙 리스트 */}
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          border: '1px solid var(--border)',
          borderRadius: 'var(--radius)',
          overflow: 'hidden',
          backgroundColor: 'var(--background)',
        }}>
          {rules.length === 0 ? (
            <div style={{ padding: '24px', textAlign: 'center', color: 'var(--muted-foreground)', fontSize: '12px' }}>
              등록된 규칙이 없습니다.
            </div>
          ) : (
            rules.map((rule, idx) => (
              <div
                key={rule.id}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '10px',
                  padding: '8px 12px',
                  borderBottom: idx < rules.length - 1 ? '1px solid var(--border)' : 'none',
                  opacity: rule.isEnabled !== false ? 1 : 0.5,
                  fontSize: '12px',
                }}
              >
                <Switch
                  checked={rule.isEnabled !== false}
                  onChange={() => handleToggleRule(rule.id)}
                  size="small"
                />

                <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: '6px', overflow: 'hidden' }}>
                  <span style={{
                    fontFamily: 'monospace',
                    backgroundColor: 'var(--muted)',
                    padding: '2px 6px',
                    borderRadius: '4px',
                    border: '1px solid var(--border)',
                    maxWidth: '120px',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                    color: 'var(--foreground)',
                  }}>
                    {rule.pattern}
                  </span>
                  <ArrowRight size={12} style={{ color: 'var(--muted-foreground)', flexShrink: 0 }} />
                  <span style={{
                    fontFamily: 'monospace',
                    backgroundColor: 'var(--muted)',
                    padding: '2px 6px',
                    borderRadius: '4px',
                    border: '1px solid var(--border)',
                    maxWidth: '120px',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                    color: 'var(--foreground)',
                  }}>
                    {rule.replacement || '(빈 문자열)'}
                  </span>
                  {rule.isRegex && (
                    <span style={{
                      fontSize: '10px',
                      padding: '1px 6px',
                      borderRadius: '4px',
                      backgroundColor: 'rgba(168, 85, 247, 0.15)',
                      color: '#a855f7',
                      border: '1px solid rgba(168, 85, 247, 0.3)',
                      marginLeft: 'auto',
                      fontWeight: 500,
                    }}>
                      Regex {rule.flags && `/${rule.flags}`}
                    </span>
                  )}
                </div>

                <button
                  type="button"
                  onClick={() => handleDeleteRule(rule.id)}
                  style={{
                    border: 'none',
                    background: 'transparent',
                    color: 'var(--muted-foreground)',
                    cursor: 'pointer',
                    padding: '4px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    borderRadius: '4px',
                  }}
                  title="삭제"
                >
                  <Trash2 size={14} style={{ color: '#ef4444' }} />
                </button>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};

export default ReplacementTab;