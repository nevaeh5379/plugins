import React, { useState } from 'react';
import type { ReplacementRule } from '../../types';
import { Input, Checkbox, Button, List, Switch, Tag, Space } from 'antd';
import { DeleteOutlined, ArrowRightOutlined } from '@ant-design/icons';

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
    <div className="tab-content" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      <div className="tab-section">
        <h4 className="tab-section-title" style={{ margin: 0, fontSize: '1.1em', fontWeight: 'bold' }}>단어 바꾸기</h4>
        <p className="section-description" style={{ fontSize: '0.85em', color: 'var(--text-secondary)', margin: '4px 0 16px 0' }}>
          로그 내용에서 특정 단어를 찾아 바꿉니다. 규칙은 위에서 아래로 순차적으로 적용됩니다.
        </p>

        {/* 규칙 추가 영역 */}
        <div style={{ background: 'var(--bg-tertiary)', padding: '16px', borderRadius: '8px', border: '1px solid var(--border-color)', marginBottom: '16px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
            <Input 
              placeholder="찾을 단어" 
              value={newPattern}
              onChange={(e) => setNewPattern(e.target.value)}
              onKeyDown={handleKeyDown}
              style={{ flex: 1 }}
            />
            <ArrowRightOutlined style={{ color: 'var(--text-secondary)' }} />
            <Input 
              placeholder="바꿀 단어" 
              value={newReplacement}
              onChange={(e) => setNewReplacement(e.target.value)}
              onKeyDown={handleKeyDown}
              style={{ flex: 1 }}
            />
          </div>
          
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <Space size="middle">
              <Checkbox 
                checked={isRegex} 
                onChange={e => setIsRegex(e.target.checked)}
                style={{ fontSize: '0.9em', color: 'var(--text-primary)' }}
              >
                정규식 (Regex)
              </Checkbox>
              {isRegex && (
                <Input 
                  value={regexFlags}
                  onChange={e => setRegexFlags(e.target.value)}
                  placeholder="g, i, m 등"
                  style={{ width: '90px' }}
                  title="Regex Flags"
                  size="small"
                />
              )}
            </Space>
            <Button 
              type="primary" 
              onClick={handleAddRule} 
              disabled={!newPattern}
            >
              추가
            </Button>
          </div>
        </div>

        {/* 규칙 리스트 */}
        <List
          size="small"
          bordered
          dataSource={rules}
          style={{ background: 'var(--bg-primary)', borderRadius: '8px', borderColor: 'var(--border-color)' }}
          locale={{ emptyText: <div style={{ padding: '24px', textAlign: 'center', color: 'var(--text-secondary)' }}>등록된 규칙이 없습니다.</div> }}
          renderItem={rule => (
            <List.Item 
              style={{ 
                display: 'flex', 
                alignItems: 'center', 
                gap: '12px', 
                padding: '8px 12px',
                borderBottom: '1px solid var(--border-color-light)',
                opacity: rule.isEnabled !== false ? 1 : 0.5,
                transition: 'opacity 0.2s'
              }}
            >
              <Switch 
                checked={rule.isEnabled !== false} 
                onChange={() => handleToggleRule(rule.id)}
                size="small"
              />
              
              <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: '8px', overflow: 'hidden' }}>
                <span 
                  style={{ 
                    fontFamily: 'monospace', 
                    background: 'var(--bg-tertiary)', 
                    padding: '2px 8px', 
                    borderRadius: '4px', 
                    border: '1px solid var(--border-color-light)',
                    maxWidth: '40%',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                    color: 'var(--text-primary)'
                  }} 
                  title={rule.pattern}
                >
                  {rule.pattern}
                </span>
                <span style={{ color: 'var(--text-secondary)', fontSize: '0.9em' }}>→</span>
                <span 
                  style={{ 
                    fontFamily: 'monospace', 
                    background: 'var(--bg-tertiary)', 
                    padding: '2px 8px', 
                    borderRadius: '4px', 
                    border: '1px solid var(--border-color-light)',
                    maxWidth: '40%',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                    color: 'var(--text-primary)'
                  }} 
                  title={rule.replacement}
                >
                  {rule.replacement || '(빈 문자열)'}
                </span>
                {rule.isRegex && (
                  <Tag color="purple" style={{ marginLeft: 'auto', fontSize: '0.8em', marginInlineEnd: 0 }}>
                    Regex {rule.flags && `/${rule.flags}`}
                  </Tag>
                )}
              </div>
              
              <Button 
                type="text" 
                danger 
                icon={<DeleteOutlined />} 
                onClick={() => handleDeleteRule(rule.id)}
                title="삭제"
                style={{ marginLeft: rule.isRegex ? '0' : 'auto' }}
              />
            </List.Item>
          )}
        />
      </div>
    </div>
  );
};

export default ReplacementTab;
