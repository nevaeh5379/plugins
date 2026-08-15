import React, { useMemo } from 'react';
import type { MessageProps } from '../../../types';
import { useMessageCard } from './useMessageCard';

// ============================================================================
// Constants & Layout Configuration
// ============================================================================

/**
 * Monospace typography stack for terminal and code-log styling.
 * Prioritizes modern programming fonts with comprehensive system fallbacks.
 */
const MONOSPACE_FONT_FAMILY =
  'Courier New, SF Mono, Monaco, Inconsolata, Fira Code, Consolas, monospace';

/**
 * Default number of digits for line number zero-padding (e.g., "0001").
 */
const DEFAULT_LINE_PAD_LENGTH = 4;

/**
 * Relative font scale multipliers for log sub-elements.
 */
const FONT_SCALE = {
  LINE_NUMBER: 0.88,
  STATUS_ICON: 0.94,
  SPEAKER_TAG: 0.94,
  TIMESTAMP: 0.82,
} as const;

/**
 * Fixed layout dimensions and spacing for the terminal log row.
 */
const LOG_LAYOUT = {
  LINE_NUMBER_WIDTH: '35px',
  STATUS_ICON_WIDTH: '15px',
  SPEAKER_TAG_WIDTH: '80px',
  ROW_GAP: '8px',
  ROW_PADDING: '8px 12px',
  LINE_HEIGHT: 1.4,
} as const;

// ============================================================================
// Pure Formatting Helpers
// ============================================================================

/**
 * Formats a 0-based message index into a 1-based, zero-padded line number string.
 *
 * @example
 * formatLineNumber(0)    // "0001"
 * formatLineNumber(41)   // "0042"
 * formatLineNumber(9, 3) // "010"
 *
 * @param index - 0-based message index
 * @param padLength - Total number of digits (defaults to 4)
 * @returns Padded line number string
 */
function formatLineNumber(
  index: number,
  padLength: number = DEFAULT_LINE_PAD_LENGTH
): string {
  return String(index + 1).padStart(padLength, '0');
}

/**
 * Resolves the directional flow icon indicating the message author:
 * - `→` (right arrow) for user outbound messages
 * - `←` (left arrow) for character / bot inbound messages
 *
 * @param isUser - Whether the message is sent by the user
 * @returns Directional unicode arrow icon
 */
function getDirectionIcon(isUser: boolean): string {
  return isUser ? '→' : '←';
}

/**
 * Formats a participant name as an uppercase bracketed terminal tag.
 *
 * @example
 * formatSpeakerTag('Assistant') // "[ASSISTANT]"
 * formatSpeakerTag('user')      // "[USER]"
 *
 * @param name - Raw participant or character name
 * @returns Uppercase bracketed speaker tag
 */
function formatSpeakerTag(name: string): string {
  return `[${(name || '').toUpperCase()}]`;
}

/**
 * Formats a Date object, timestamp number, or ISO string into a localized terminal timestamp.
 *
 * @param dateInput - Date, timestamp, or string to format
 * @param format - Format variant: `'time-only'` (`HH:mm:ss`) or `'iso-datetime'` (`YYYY-MM-DD HH:mm:ss`)
 * @returns Formatted timestamp string, or empty string if input is invalid
 */
function formatLogTimestamp(
  dateInput?: Date | string | number | null,
  format: 'time-only' | 'iso-datetime' = 'time-only'
): string {
  if (dateInput === null || dateInput === undefined) return '';
  const date = dateInput instanceof Date ? dateInput : new Date(dateInput);
  if (isNaN(date.getTime())) return '';

  const pad = (n: number) => (n < 10 ? `0${n}` : String(n));
  const hours = pad(date.getHours());
  const minutes = pad(date.getMinutes());
  const seconds = pad(date.getSeconds());

  if (format === 'iso-datetime') {
    const year = date.getFullYear();
    const month = pad(date.getMonth() + 1);
    const day = pad(date.getDate());
    return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
  }

  return `${hours}:${minutes}:${seconds}`;
}

// Suppress unused warning if timestamp formatting is reserved for future extensions
void formatLogTimestamp;

// ============================================================================
// Style Builders
// ============================================================================

/**
 * Builds container style for the log row.
 */
function getContainerStyle(
  backgroundColor: string,
  borderColor: string,
  baseSize: string
): React.CSSProperties {
  return {
    position: 'relative',
    display: 'flex',
    alignItems: 'flex-start',
    gap: LOG_LAYOUT.ROW_GAP,
    padding: LOG_LAYOUT.ROW_PADDING,
    background: backgroundColor,
    border: `1px solid ${borderColor}`,
    marginBottom: '2px',
    fontFamily: MONOSPACE_FONT_FAMILY,
    fontSize: baseSize,
    transition: 'all 0.2s ease',
  };
}

/**
 * Builds line number column style.
 */
function getLineNumberStyle(
  color: string | undefined,
  borderColor: string,
  baseSize: string
): React.CSSProperties {
  return {
    color: color,
    fontSize: `calc(${baseSize} * ${FONT_SCALE.LINE_NUMBER})`,
    width: LOG_LAYOUT.LINE_NUMBER_WIDTH,
    flexShrink: 0,
    textAlign: 'right',
    paddingRight: '8px',
    borderRight: `1px solid ${borderColor}`,
    opacity: 0.6,
  };
}

/**
 * Builds status direction indicator column style.
 */
function getStatusIconStyle(
  color: string,
  baseSize: string
): React.CSSProperties {
  return {
    color: color,
    fontSize: `calc(${baseSize} * ${FONT_SCALE.STATUS_ICON})`,
    width: LOG_LAYOUT.STATUS_ICON_WIDTH,
    flexShrink: 0,
    textAlign: 'center',
    fontWeight: 'bold',
  };
}

/**
 * Builds speaker tag column style.
 */
function getSpeakerTagStyle(
  color: string,
  baseSize: string
): React.CSSProperties {
  return {
    color: color,
    fontWeight: 'bold',
    width: LOG_LAYOUT.SPEAKER_TAG_WIDTH,
    flexShrink: 0,
    textOverflow: 'ellipsis',
    overflow: 'hidden',
    whiteSpace: 'nowrap',
    fontSize: `calc(${baseSize} * ${FONT_SCALE.SPEAKER_TAG})`,
  };
}

/**
 * Builds message body content area style.
 */
function getContentStyle(
  color: string,
  baseSize: string
): React.CSSProperties {
  return {
    color: color,
    flex: 1,
    lineHeight: LOG_LAYOUT.LINE_HEIGHT,
    wordWrap: 'break-word',
    fontSize: baseSize,
  };
}

// ============================================================================
// Main Component
// ============================================================================

/**
 * LogMessage — Terminal / IDE code-log theme message card component.
 *
 * Emulates a monospace code editor / log file turn:
 * 1. Padded 4-digit line numbers (`0001`, `0002`, ...).
 * 2. Direction indicators (`→` for user outbound, `←` for character inbound).
 * 3. Uppercase bracketed speaker tags (`[USER]`, `[CHARACTER]`).
 * 4. Monospace content body with editable capability.
 * 5. Integrated delete button when editable mode is active.
 */
const LogMessage: React.FC<MessageProps> = (props) => {
  const { index, color, isEditable } = props;
  const mc = useMessageCard(props);
  const { isUser, name, baseSize, contentRef, handleBlur, handleContentClick } = mc;

  // Memoized formatted elements
  const lineNumber = useMemo(() => formatLineNumber(index), [index]);
  const statusIcon = useMemo(() => getDirectionIcon(isUser), [isUser]);
  const speakerTag = useMemo(() => formatSpeakerTag(name), [name]);

  // Resolved colors
  const logBg = isUser ? color.cardBgUser : color.cardBg;

  // Resolved component styles
  const containerStyle = useMemo(
    () => getContainerStyle(logBg, color.border, baseSize),
    [logBg, color.border, baseSize]
  );

  const lineNumberStyle = useMemo(
    () => getLineNumberStyle(color.textSecondary, color.border, baseSize),
    [color.textSecondary, color.border, baseSize]
  );

  const statusIconStyle = useMemo(
    () => getStatusIconStyle(color.nameColor, baseSize),
    [color.nameColor, baseSize]
  );

  const speakerTagStyle = useMemo(
    () => getSpeakerTagStyle(color.nameColor, baseSize),
    [color.nameColor, baseSize]
  );

  const contentStyle = useMemo(
    () => getContentStyle(color.text, baseSize),
    [color.text, baseSize]
  );

  return (
    <div className="chat-message-container" style={containerStyle}>
      {/* Line number gutter */}
      <div style={lineNumberStyle}>
        {lineNumber}
      </div>

      {/* Direction status arrow indicator */}
      <div style={statusIconStyle}>
        {statusIcon}
      </div>

      {/* Bracketed uppercase speaker label */}
      <div style={speakerTagStyle} title={name}>
        {speakerTag}
      </div>

      {/* Message content area */}
      <div
        ref={contentRef}
        style={contentStyle}
        contentEditable={isEditable}
        onBlur={handleBlur}
        onClick={handleContentClick}
        suppressContentEditableWarning={true}
      />

      {/* Message deletion button */}
      {isEditable && (
        <button
          className="log-exporter-delete-msg-btn"
          data-message-index={index}
          title="메시지 삭제"
        >
          &times;
        </button>
      )}
    </div>
  );
};

export default LogMessage;
