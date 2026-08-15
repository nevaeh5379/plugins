import React, { useMemo } from 'react';
import type { LogHeaderProps, ColorPalette } from '../../../types';
import { useAvatarBlob, useParsedTags } from '../../hooks/useHeaderHelpers';
import HeaderTags from './HeaderTags';

/**
 * Generates styling definitions for ModernHeader based on the active color palette.
 */
function createModernHeaderStyles(color: ColorPalette) {
  return {
    header: {
      display: 'flex',
      alignItems: 'center',
      gap: '20px',
      padding: '20px',
      marginBottom: '2em',
      backgroundColor: color.cardBg,
      borderRadius: '12px',
      border: `1px solid ${color.border}`,
      boxShadow: color.shadow,
    } as const satisfies React.CSSProperties,

    avatarWrapper: {
      position: 'relative',
      flexShrink: 0,
    } as const satisfies React.CSSProperties,

    avatarImage: {
      width: '72px',
      height: '72px',
      borderRadius: '12px',
      objectFit: 'cover',
      display: 'block',
      border: `1px solid ${color.border}`,
    } as const satisfies React.CSSProperties,

    statusBadge: {
      position: 'absolute',
      bottom: '-3px',
      right: '-3px',
      width: '14px',
      height: '14px',
      borderRadius: '50%',
      backgroundColor: '#22c55e',
      border: `3px solid ${color.cardBg}`,
    } as const satisfies React.CSSProperties,

    contentContainer: {
      flex: 1,
      minWidth: 0,
    } as const satisfies React.CSSProperties,

    titleRow: {
      display: 'flex',
      alignItems: 'center',
      gap: '10px',
      marginBottom: '4px',
      flexWrap: 'wrap',
    } as const satisfies React.CSSProperties,

    nameTitle: {
      margin: 0,
      fontSize: '1.5em',
      color: color.nameColor,
      fontWeight: 700,
      letterSpacing: '-0.02em',
    } as const satisfies React.CSSProperties,

    chatDescription: {
      margin: 0,
      color: color.text,
      opacity: 0.75,
      fontSize: '0.9em',
      lineHeight: 1.5,
    } as const satisfies React.CSSProperties,
  };
}

/**
 * Modern card-style header component for LogExporter.
 * Displays character avatar with an online indicator badge, character name, tags, and chat subtitle.
 */
export const ModernHeader: React.FC<LogHeaderProps> = React.memo(({
  charInfo,
  color,
  embedImagesAsBlob = false,
  showHeaderIcon = true,
  headerTags,
}) => {
  const avatarSrc = useAvatarBlob(charInfo.avatarUrl, embedImagesAsBlob);
  const tags = useParsedTags(headerTags);
  const styles = useMemo(() => createModernHeaderStyles(color), [color]);

  return (
    <header style={styles.header}>
      {showHeaderIcon !== false && (
        <div style={styles.avatarWrapper}>
          <img
            src={avatarSrc || charInfo.avatarUrl}
            alt={charInfo.name ? `${charInfo.name} avatar` : 'Avatar'}
            data-log-exporter-avatar="true"
            style={styles.avatarImage}
          />
          <div style={styles.statusBadge} aria-hidden="true" />
        </div>
      )}

      <div style={styles.contentContainer}>
        <div style={styles.titleRow}>
          <h1 style={styles.nameTitle}>{charInfo.name}</h1>
          <HeaderTags tags={tags} color={color} variant="modern" />
        </div>
        <p style={styles.chatDescription}>{charInfo.chatName}</p>
      </div>
    </header>
  );
});

ModernHeader.displayName = 'ModernHeader';

export default ModernHeader;

