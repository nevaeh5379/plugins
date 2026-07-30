import React from 'react';
import { Switch } from 'antd';

interface SettingToggleProps {
  label: string;
  description?: string;
  checked?: boolean;
  defaultOn?: boolean;
  onChange: (checked: boolean) => void;
}

const SettingToggle: React.FC<SettingToggleProps> = ({
  label,
  description,
  checked,
  defaultOn = true,
  onChange,
}) => {
  const isChecked = defaultOn ? checked !== false : checked === true;
  return (
    <div className="setting-toggle-row" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px', padding: '2px 0' }}>
      <div className="setting-toggle-info" style={{ display: 'flex', flexDirection: 'column', gap: '2px', flex: 1, minWidth: 0 }}>
        <span className="setting-toggle-label" style={{ fontSize: '12px', fontWeight: 500, color: 'var(--foreground)' }}>{label}</span>
        {description && <span className="setting-toggle-desc" style={{ fontSize: '11px', color: 'var(--muted-foreground)' }}>{description}</span>}
      </div>
      <Switch checked={isChecked} onChange={onChange} size="small" />
    </div>
  );
};

export default SettingToggle;