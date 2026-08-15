import React, { useId } from 'react';
import { Switch } from '../../components/ui';
import { cn } from '../../lib/utils';

export interface SettingToggleProps {
  /** The primary label text or element for the toggle */
  label: React.ReactNode;
  /** Optional secondary description text or element */
  description?: React.ReactNode;
  /** Whether the toggle switch is checked */
  checked?: boolean;
  /** Default checked state when `checked` is undefined (default: true) */
  defaultOn?: boolean;
  /** Whether the toggle switch is disabled */
  disabled?: boolean;
  /** Size variant for the switch control (default: 'small') */
  size?: 'small' | 'default';
  /** Optional identifier for accessibility element associations */
  id?: string;
  /** Optional custom CSS class names for the container row */
  className?: string;
  /** Optional custom inline styles for the container row */
  style?: React.CSSProperties;
  /** Callback fired when the toggle state changes */
  onChange: (checked: boolean) => void;
}

/**
 * SettingToggle - A reusable setting row component combining a label,
 * optional description, and an accessible toggle switch.
 */
export const SettingToggle: React.FC<SettingToggleProps> = React.memo(({
  label,
  description,
  checked,
  defaultOn = true,
  disabled = false,
  size = 'small',
  id,
  className,
  style,
  onChange,
}) => {
  const generatedId = useId();
  const switchId = id || generatedId;
  const labelId = `${switchId}-label`;
  const descId = `${switchId}-desc`;

  // Determine checked state: respects explicit boolean; falls back to defaultOn
  const isChecked = checked !== undefined ? checked : defaultOn;

  return (
    <div
      className={cn(
        'setting-toggle-row flex items-center justify-between gap-3 py-0.5 min-h-[28px]',
        disabled && 'opacity-60 cursor-not-allowed',
        className
      )}
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: '12px',
        padding: '2px 0',
        ...style,
      }}
    >
      <div
        className="setting-toggle-info flex flex-col gap-0.5 flex-1 min-w-0 select-none"
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: '2px',
          flex: 1,
          minWidth: 0,
        }}
      >
        <label
          htmlFor={switchId}
          id={labelId}
          className={cn(
            'setting-toggle-label text-xs font-medium text-[var(--foreground)]',
            disabled ? 'cursor-not-allowed' : 'cursor-pointer'
          )}
          style={{
            fontSize: '12px',
            fontWeight: 500,
            color: 'var(--foreground)',
            cursor: disabled ? 'not-allowed' : 'pointer',
          }}
        >
          {label}
        </label>

        {description && (
          <span
            id={descId}
            className="setting-toggle-desc text-[11px] text-[var(--muted-foreground)] leading-tight"
            style={{
              fontSize: '11px',
              color: 'var(--muted-foreground)',
            }}
          >
            {description}
          </span>
        )}
      </div>

      <Switch
        id={switchId}
        size={size}
        checked={isChecked}
        disabled={disabled}
        onChange={onChange}
        aria-labelledby={labelId}
        aria-describedby={description ? descId : undefined}
      />
    </div>
  );
});

SettingToggle.displayName = 'SettingToggle';

export default SettingToggle;