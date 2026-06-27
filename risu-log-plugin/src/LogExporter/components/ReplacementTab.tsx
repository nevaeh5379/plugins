import React, { useState } from 'react';
import type { ReplacementRule } from '../../types';
import { Input, Checkbox, Button, List, Switch, Tag, Space, Typography } from 'antd';
import { DeleteOutlined, ArrowRightOutlined } from '@ant-design/icons';

const { Title, Text } = Typography;

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
    <div className="tab-content">
      <div className="tab-section">
        <Title level={5} className="tab-section-title">단어 바꾸기</Title>
        <Text type="secondary" style={{ fontSize: '0.85em' }}>
          로그 내용에서 특정 단어를 찾아 바꿉니다. 규칙은 위에서 아래로 순차적으로 적용됩니다.
        </Text>

        {/* 규칙 추가 영역 */}
        <div className="replacement-add-card">
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
              }}
            >
              <Switch
                checked={rule.isEnabled !== false}
                onChange={() => handleToggleRule(rule.id)}
                size="small"
              />

              <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: '8px', overflow: 'hidden' }}>
                <span className="replacement-token" title={rule.pattern}>
                  {rule.pattern}
                </span>
                <span style={{ color: 'var(--text-secondary)', fontSize: '0.9em' }}>→</span>
                <span className="replacement-token" title={rule.replacement}>
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