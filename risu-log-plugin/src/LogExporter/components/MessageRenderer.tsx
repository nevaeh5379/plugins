import React, { useCallback } from 'react';
import type { MessageProps, ThemeKey } from '../../types';
import BasicMessage from './themes/BasicMessage';
import CustomMessage from './themes/CustomMessage';
import ModernMessage from './themes/ModernMessage';
import SmartMessage from './themes/SmartMessage';
import SimpleMessage from './themes/SimpleMessage';
import LogMessage from './themes/LogMessage';
import RawMessage from './themes/RawMessage';

// ── Theme Mapping & Resolution ──────────────────────────────────────────────

/**
 * Registry mapping supported theme keys to their corresponding React message components.
 */
const THEME_COMPONENTS: Record<ThemeKey, React.ComponentType<MessageProps>> = {
  basic: BasicMessage,
  custom: CustomMessage,
  modern: ModernMessage,
  smart: SmartMessage,
  simple: SimpleMessage,
  log: LogMessage,
  raw: RawMessage,
};

/**
 * Resolves the message theme component based on the provided theme key.
 * Defaults to `BasicMessage` if the key is unrecognized or omitted.
 */
function resolveThemeComponent(themeKey?: ThemeKey): React.ComponentType<MessageProps> {
  if (!themeKey) return BasicMessage;
  return THEME_COMPONENTS[themeKey] ?? BasicMessage;
}

// ── Static Styles ───────────────────────────────────────────────────────────

const SELECTED_BACKGROUND_COLOR = 'rgba(0, 123, 255, 0.2)';

const EDITABLE_WRAPPER_BASE_STYLE: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  cursor: 'pointer',
  borderRadius: '4px',
};

const CHECKBOX_STYLE: React.CSSProperties = {
  margin: '0 10px',
  cursor: 'pointer',
};

const MESSAGE_CONTENT_STYLE: React.CSSProperties = {
  flex: 1,
  minWidth: 0,
};

// ── Component ───────────────────────────────────────────────────────────────

/**
 * MessageRenderer routes a chat message node to its corresponding theme component.
 * In editable mode, it wraps the message with a selection container and interactive checkbox.
 */
const MessageRenderer: React.FC<MessageProps> = (props) => {
  const { node, themeKey, isSelected, onSelect, index, isEditable } = props;

  const handleContainerClick = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      onSelect?.(index, e);
    },
    [onSelect, index]
  );

  // When clicking the checkbox directly, stop propagation to prevent double-firing
  const handleCheckboxClick = useCallback(
    (e: React.MouseEvent<HTMLInputElement>) => {
      e.stopPropagation();
      onSelect?.(index, e);
    },
    [onSelect, index]
  );

  // Guard against empty / invalid nodes
  if (!node) {
    return null;
  }

  const MessageComponent = resolveThemeComponent(themeKey);

  if (!isEditable) {
    return <MessageComponent {...props} />;
  }

  const wrapperStyle: React.CSSProperties = {
    ...EDITABLE_WRAPPER_BASE_STYLE,
    backgroundColor: isSelected ? SELECTED_BACKGROUND_COLOR : undefined,
  };

  return (
    <div
      style={wrapperStyle}
      onClick={handleContainerClick}
      role="button"
      tabIndex={0}
      aria-pressed={Boolean(isSelected)}
      aria-label={`Select message ${index + 1}`}
      onKeyDown={(e) => {
        if (e.key === ' ' || e.key === 'Enter') {
          e.preventDefault();
          onSelect?.(index, e as unknown as React.MouseEvent);
        }
      }}
    >
      <input
        type="checkbox"
        checked={Boolean(isSelected)}
        onClick={handleCheckboxClick}
        readOnly // State is controlled by parent selection model
        aria-label={`Select message ${index + 1}`}
        style={CHECKBOX_STYLE}
      />
      <div style={MESSAGE_CONTENT_STYLE}>
        <MessageComponent {...props} />
      </div>
    </div>
  );
};

// ── Memoization & Equality Comparison ───────────────────────────────────────

/**
 * Compares two avatar Map instances for shallow equality of keys and values.
 */
function areAvatarMapsEqual(
  prevMap?: Map<string, string>,
  nextMap?: Map<string, string>
): boolean {
  if (prevMap === nextMap) return true;
  if (!prevMap || !nextMap) return false;
  if (prevMap.size !== nextMap.size) return false;

  for (const [key, val] of prevMap.entries()) {
    if (nextMap.get(key) !== val) return false;
  }

  return true;
}

/**
 * List of scalar and referential props to check for equality.
 * Callbacks (onSelect, onRendered, onMessageUpdate) are intentionally omitted
 * so parent callback recreation doesn't trigger mass re-rendering of log items.
 */
const SCALAR_PROPS_TO_COMPARE: readonly (keyof MessageProps)[] = [
  'index',
  'isSelected',
  'themeKey',
  'showAvatar',
  'showBubble',
  'isEditable',
  'fontSize',
  'imageScale',
  'imageAlign',
  'imageStyle',
  'imageCropActive',
  'imageCropAspectRatio',
  'imageCropVAlign',
  'imageCropHAlign',
  'imageCropHeight',
  'isForExport',
  'isForArca',
  'embedImagesAsBlob',
  'allowHtmlRendering',
  'charInfoName',
  'node',
  'color',
  'globalSettings',
  'replacementRules',
] as const;

/**
 * Custom comparison function to avoid redundant message re-renders in large chat logs.
 */
function arePropsEqual(prevProps: MessageProps, nextProps: MessageProps): boolean {
  for (let i = 0; i < SCALAR_PROPS_TO_COMPARE.length; i++) {
    const key = SCALAR_PROPS_TO_COMPARE[i];
    if (prevProps[key] !== nextProps[key]) {
      return false;
    }
  }

  if (!areAvatarMapsEqual(prevProps.avatarMap, nextProps.avatarMap)) {
    return false;
  }

  return true;
}

const MemoizedMessageRenderer = React.memo(MessageRenderer, arePropsEqual);
MemoizedMessageRenderer.displayName = 'MessageRenderer';

export default MemoizedMessageRenderer;
