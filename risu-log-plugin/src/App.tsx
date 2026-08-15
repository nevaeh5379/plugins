// src/App.tsx
import React, { useState, useCallback } from 'react';
import './App.css';

/**
 * Props for the {@link HelloPanel} component.
 */
export interface HelloPanelProps {
  /** Optional callback invoked when the user clicks the Close button. */
  onClose?: () => void;
  /** Panel heading text. Defaults to `"Hello, RisuAI!"`. */
  title?: string;
  /** Descriptive body text. Defaults to `"This panel is rendered by React."`. */
  description?: string;
  /** Initial counter value. Defaults to `0`. */
  initialCount?: number;
  /** Additional CSS class names to apply to the root container. */
  className?: string;
  /** Inline style overrides for the root container. */
  style?: React.CSSProperties;
}

export type AppProps = HelloPanelProps;

/**
 * Starter / demo panel component used to verify React mounting
 * and interactivity within RisuAI plugin environments or dev previews.
 */
export const HelloPanel: React.FC<HelloPanelProps> = ({
  onClose,
  title = 'Hello, RisuAI!',
  description = 'This panel is rendered by React.',
  initialCount = 0,
  className = '',
  style,
}) => {
  const [count, setCount] = useState<number>(initialCount);

  const handleIncrement = useCallback(() => {
    setCount((prev) => prev + 1);
  }, []);

  const handleClose = useCallback(() => {
    onClose?.();
  }, [onClose]);

  const containerClassName = className
    ? `hello-panel ${className}`
    : 'hello-panel';

  return (
    <div
      role="region"
      aria-label={title}
      className={containerClassName}
      style={style}
    >
      <h1>{title}</h1>
      <p>{description}</p>
      <p aria-live="polite">Button clicked: {count} times</p>
      <button type="button" onClick={handleIncrement}>
        Click Me!
      </button>
      <button
        type="button"
        onClick={handleClose}
        style={{ marginLeft: '10px' }}
      >
        Close
      </button>
    </div>
  );
};

export const App = HelloPanel;

export default HelloPanel;