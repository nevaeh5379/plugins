
import React, { useMemo } from 'react';
import type { LogHeaderProps } from '../../../types';
import { useHeaderDate, useParsedTags } from '../../hooks/useHeaderHelpers';

// ============================================================================
// Constants & Color Palette
// ============================================================================

/**
 * IDE / code editor syntax highlighting color palette.
 */
const SYNTAX_COLORS = {
  background: '#1e1e1e',
  text: '#cccccc',
  keyword: '#569cd6',
  string: '#ce9178',
  date: '#b5cea8',
  comment: '#6a9955',
  divider: '#444444',
} as const;

/**
 * Monospace font family stack for the terminal log aesthetic.
 */
const MONOSPACE_FONT_FAMILY = 'Consolas, Monaco, "Andale Mono", "Ubuntu Mono", monospace';

// ============================================================================
// Styles
// ============================================================================

const styles = {
  container: (accentColor: string): React.CSSProperties => ({
    marginBottom: '2em',
    padding: '1.5em',
    backgroundColor: SYNTAX_COLORS.background,
    color: SYNTAX_COLORS.text,
    fontFamily: MONOSPACE_FONT_FAMILY,
    fontSize: '0.9em',
    borderLeft: `4px solid ${accentColor}`,
    lineHeight: 1.6,
  }),
  entry: {
    marginBottom: '0.5em',
  } as React.CSSProperties,
  keyword: {
    color: SYNTAX_COLORS.keyword,
  } as React.CSSProperties,
  stringValue: {
    color: SYNTAX_COLORS.string,
  } as React.CSSProperties,
  dateValue: {
    color: SYNTAX_COLORS.date,
  } as React.CSSProperties,
  commentSection: {
    marginTop: '1em',
    borderTop: `1px dashed ${SYNTAX_COLORS.divider}`,
    paddingTop: '0.5em',
    color: SYNTAX_COLORS.comment,
  } as React.CSSProperties,
};

// ============================================================================
// Helper Subcomponents
// ============================================================================

interface LogThemeEntryProps {
  /** Property label name (e.g. TARGET_ID, CONTEXT, DATE, TAGS). */
  label: string;
  /** Property value or formatted element content. */
  children: React.ReactNode;
}

/**
 * Renders a single terminal/code-styled metadata entry line:
 * `> LABEL: value`
 */
const LogThemeEntry: React.FC<LogThemeEntryProps> = ({ label, children }) => (
  <div style={styles.entry}>
    <span style={styles.keyword}>&gt; {label}:</span> {children}
  </div>
);

// ============================================================================
// Main Component
// ============================================================================

/**
 * Log theme header component.
 *
 * Renders character and chat metadata with an IDE/terminal code aesthetic,
 * featuring syntax-highlighted properties and a colored accent border.
 */
const LogThemeHeader: React.FC<LogHeaderProps> = ({ charInfo, color, headerTags }) => {
  const tags = useParsedTags(headerTags);
  const today = useHeaderDate(undefined, { format: 'iso-date' });

  const formattedTags = useMemo(() => {
    if (tags.length === 0) return '';
    return `[${tags.map(tag => `'${tag}'`).join(', ')}]`;
  }, [tags]);

  const accentColor = color?.nameColor || SYNTAX_COLORS.keyword;

  return (
    <header style={styles.container(accentColor)}>
      <LogThemeEntry label="TARGET_ID">
        <span style={styles.stringValue}>"{charInfo?.name ?? ''}"</span>
      </LogThemeEntry>

      <LogThemeEntry label="CONTEXT">
        <span style={styles.stringValue}>"{charInfo?.chatName ?? ''}"</span>
      </LogThemeEntry>

      <LogThemeEntry label="DATE">
        <span style={styles.dateValue}>{today}</span>
      </LogThemeEntry>

      {tags.length > 0 && (
        <LogThemeEntry label="TAGS">
          <span>{formattedTags}</span>
        </LogThemeEntry>
      )}

      <div style={styles.commentSection}>
        // Recording started...
      </div>
    </header>
  );
};

export default LogThemeHeader;

