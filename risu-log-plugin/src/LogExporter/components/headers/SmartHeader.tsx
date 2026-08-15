import React, { useMemo } from 'react';
import type { LogHeaderProps, ColorPalette } from '../../../types';
import { useAvatarBlob, useParsedTags } from '../../hooks/useHeaderHelpers';
import HeaderTags from './HeaderTags';

/**
 * Generates styling definitions for SmartHeader based on the active color palette.
 */
function createSmartHeaderStyles(color: ColorPalette) {
  return {
    header: {
      padding: '20px 0 32px',
      display: 'flex',
      justifyContent: 'center',
    } as const satisfies React.CSSProperties,

    card: {
      display: 'flex',
      alignItems: 'center',
      gap: '20px',
      padding: '20px 28px',
      background: color.cardBg,
      backdropFilter: 'blur(16px) saturate(180%)',
      WebkitBackdropFilter: 'blur(16px) saturate(180%)',
      borderRadius: '20px',
      border: `1px solid ${color.border}`,
      boxShadow: '0 8px 32px rgba(0, 0, 0, 0.2)',
      maxWidth: '90%',
      minWidth: '280px',
    } as const satisfies React.CSSProperties,

    avatarWrapper: {
      position: 'relative',
      flexShrink: 0,
    } as const satisfies React.CSSProperties,

    avatarGlow: {
      position: 'absolute',
      top: '10%',
      left: '10%',
      right: '10%',
      bottom: '10%',
      background: color.nameColor,
      filter: 'blur(16px)',
      opacity: 0.3,
      borderRadius: '50%',
      zIndex: 0,
      pointerEvents: 'none',
    } as const satisfies React.CSSProperties,

    avatarImage: {
      position: 'relative',
      zIndex: 1,
      width: '76px',
      height: '76px',
      borderRadius: '18px',
      objectFit: 'cover',
      display: 'block',
      boxShadow: '0 4px 12px rgba(0, 0, 0, 0.1)',
    } as const satisfies React.CSSProperties,

    contentContainer: {
      display: 'flex',
      flexDirection: 'column',
      gap: '3px',
      minWidth: 0,
    } as const satisfies React.CSSProperties,

    titleRow: {
      display: 'flex',
      alignItems: 'center',
      gap: '8px',
      flexWrap: 'wrap',
    } as const satisfies React.CSSProperties,

    title: {
      margin: 0,
      fontSize: '1.6em',
      color: color.text,
      fontWeight: 700,
      letterSpacing: '-0.01em',
      lineHeight: 1.2,
    } as const satisfies React.CSSProperties,

    dot: {
      width: '5px',
      height: '5px',
      borderRadius: '50%',
      background: color.nameColor,
      opacity: 0.7,
      flexShrink: 0,
    } as const satisfies React.CSSProperties,

    chatName: {
      margin: 0,
      color: color.textSecondary || color.text,
      fontSize: '0.9em',
      fontWeight: 500,
    } as const satisfies React.CSSProperties,
  };
}

/**
 * Glassmorphic floating card header component for LogExporter ("smart" theme/layout).
 * Features a frosted-glass background card with backdrop blur, an ambient character
 * glow underneath the rounded avatar, character title with accent dot, and pill tags.
 */
export const SmartHeader: React.FC<LogHeaderProps> = React.memo(({
  charInfo,
  color,
  embedImagesAsBlob = false,
  showHeaderIcon = true,
  headerTags,
}) => {
  const avatarSrc = useAvatarBlob(charInfo.avatarUrl, embedImagesAsBlob);
  const tags = useParsedTags(headerTags);
  const styles = useMemo(() => createSmartHeaderStyles(color), [color]);

  return (
    <header style={styles.header}>
      <div style={styles.card}>
        {showHeaderIcon !== false && (
          <div style={styles.avatarWrapper}>
            <div style={styles.avatarGlow} aria-hidden="true" />
            <img
              src={avatarSrc || charInfo.avatarUrl}
              alt={charInfo.name ? `${charInfo.name} avatar` : 'Avatar'}
              data-log-exporter-avatar="true"
              style={styles.avatarImage}
            />
          </div>
        )}

        <div style={styles.contentContainer}>
          <div style={styles.titleRow}>
            <h1 style={styles.title}>{charInfo.name}</h1>
            <span style={styles.dot} aria-hidden="true" />
          </div>
          <p style={styles.chatName}>{charInfo.chatName}</p>
          <HeaderTags tags={tags} color={color} variant="smart" />
        </div>
      </div>
    </header>
  );
});

SmartHeader.displayName = 'SmartHeader';

export default SmartHeader;
