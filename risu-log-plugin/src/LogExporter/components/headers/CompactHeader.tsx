import React, { useMemo } from 'react';
import type { LogHeaderProps, ColorPalette } from '../../../types';
import { useAvatarBlob, useParsedTags } from '../../hooks/useHeaderHelpers';
import HeaderTags from './HeaderTags';

/**
 * Generates style definitions for the compact header based on the active color palette.
 */
function createCompactHeaderStyles(color: ColorPalette) {
  return {
    header: {
      paddingBottom: '0.8em',
      marginBottom: '1.2em',
      borderBottom: `1px solid ${color.border}`,
    } as const satisfies React.CSSProperties,
    content: {
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      gap: '12px',
    } as const satisfies React.CSSProperties,
    avatar: {
      width: '44px',
      height: '44px',
      borderRadius: '50%',
      objectFit: 'cover',
      boxShadow: color.shadow,
    } as const satisfies React.CSSProperties,
    textContainer: {
      textAlign: 'left',
    } as const satisfies React.CSSProperties,
    title: {
      color: color.nameColor,
      margin: 0,
      fontSize: '1.3em',
      fontWeight: 700,
    } as const satisfies React.CSSProperties,
    subtitle: {
      color: color.textSecondary || color.text,
      opacity: 0.7,
      margin: 0,
      fontSize: '0.8em',
    } as const satisfies React.CSSProperties,
  };
}

/**
 * CompactHeader renders a minimal, horizontally-centered log header
 * containing a small avatar, character name, chat subtitle, and compact tags.
 */
const CompactHeader: React.FC<LogHeaderProps> = ({
  charInfo,
  color,
  embedImagesAsBlob,
  showHeaderIcon = true,
  headerTags,
}) => {
  const avatarSrc = useAvatarBlob(charInfo.avatarUrl, embedImagesAsBlob);
  const tags = useParsedTags(headerTags);

  const styles = useMemo(() => createCompactHeaderStyles(color), [color]);

  return (
    <header style={styles.header}>
      <div style={styles.content}>
        {showHeaderIcon !== false && (
          <img
            src={avatarSrc}
            alt={charInfo.name || 'Avatar'}
            data-log-exporter-avatar="true"
            style={styles.avatar}
          />
        )}
        <div style={styles.textContainer}>
          <h1 style={styles.title}>{charInfo.name}</h1>
          <p style={styles.subtitle}>{charInfo.chatName}</p>
        </div>
      </div>
      <HeaderTags tags={tags} color={color} variant="compact" />
    </header>
  );
};

export default CompactHeader;

