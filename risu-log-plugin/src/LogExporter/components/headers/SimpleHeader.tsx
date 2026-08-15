import React, { useMemo } from 'react';
import type { LogHeaderProps } from '../../../types';
import { useParsedTags } from '../../hooks/useHeaderHelpers';
import HeaderTags from './HeaderTags';

/**
 * Minimalist horizontal header component for LogExporter.
 *
 * Displays character name, session/scenario title, and tags in a single-row
 * baseline-aligned bar with a subtle bottom divider border.
 */
const SimpleHeader: React.FC<LogHeaderProps> = ({
  charInfo,
  color,
  headerTags,
}) => {
  const tags = useParsedTags(headerTags);

  const containerStyle = useMemo<React.CSSProperties>(
    () => ({
      paddingBottom: '0.8em',
      marginBottom: '1.6em',
      borderBottom: `1px solid ${color.border}`,
      display: 'flex',
      alignItems: 'baseline',
      justifyContent: 'space-between',
      flexWrap: 'wrap',
      gap: '8px',
    }),
    [color.border]
  );

  const titleGroupStyle = useMemo<React.CSSProperties>(
    () => ({
      display: 'flex',
      alignItems: 'baseline',
      gap: '10px',
    }),
    []
  );

  const nameStyle = useMemo<React.CSSProperties>(
    () => ({
      margin: 0,
      fontSize: '1.4em',
      fontWeight: 700,
      color: color.nameColor,
    }),
    [color.nameColor]
  );

  const chatNameStyle = useMemo<React.CSSProperties>(
    () => ({
      fontSize: '0.88em',
      color: color.textSecondary || color.text,
    }),
    [color.textSecondary, color.text]
  );

  return (
    <header style={containerStyle}>
      <div style={titleGroupStyle}>
        <h1 style={nameStyle}>{charInfo.name}</h1>
        <span style={chatNameStyle}>{charInfo.chatName}</span>
      </div>
      <HeaderTags tags={tags} color={color} variant="simple" />
    </header>
  );
};

export default React.memo(SimpleHeader);

