import React from 'react';
import { Switch, Typography } from 'antd';

const { Text } = Typography;

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
    <div className="setting-toggle-row">
      <div className="setting-toggle-info">
        <Text className="setting-toggle-label">{label}</Text>
        {description && <Text type="secondary" className="setting-toggle-desc">{description}</Text>}
      </div>
      <Switch checked={isChecked} onChange={onChange} />
    </div>
  );
};

export default SettingToggle;