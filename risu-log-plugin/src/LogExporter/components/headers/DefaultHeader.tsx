import React, { useMemo } from 'react';
import type { LogHeaderProps } from '../../../types';
import { useAvatarBlob, useParsedTags } from '../../hooks/useHeaderHelpers';
import HeaderTags from './HeaderTags';

/**
 * DefaultHeader component.
 *
 * Renders the default centered header layout for exported chat logs:
 * - Centered circular character avatar (toggleable via `showHeaderIcon`)
 * - Primary character name title
 * - Secondary chat session/scenario subtitle
 * - Header metadata tags
 */
const DefaultHeader: React.FC<LogHeaderProps> = ({
  charInfo,
  color,
  embedImagesAsBlob,
  showHeaderIcon = true,
  headerTags,
}) => {
  const avatarSrc = useAvatarBlob(charInfo.avatarUrl, embedImagesAsBlob);
  const tags = useParsedTags(headerTags);

  const styles = useMemo(
    () => ({
      header: {
        textAlign: 'center',
        paddingBottom: '1.2em',
        marginBottom: '1.8em',
        borderBottom: `1px solid ${color.border}`,
      },
      avatar: {
        width: '72px',
        height: '72px',
        borderRadius: '50%',
        objectFit: 'cover',
        margin: '0 auto 0.8em',
        display: 'block',
        border: `2px solid ${color.avatarBorder}`,
        boxShadow: color.shadow,
      },
      title: {
        color: color.nameColor,
        margin: '0 0 0.2em 0',
        fontSize: '1.6em',
        fontWeight: 700,
        letterSpacing: '-0.01em',
      },
      subtitle: {
        color: color.textSecondary || color.text,
        opacity: 0.8,
        margin: 0,
        fontSize: '0.88em',
      },
    } satisfies Record<string, React.CSSProperties>),
    [color]
  );

  return (
    <header style={styles.header}>
      {showHeaderIcon && (
        <img
          src={avatarSrc}
          alt={charInfo.name ? `${charInfo.name} avatar` : 'Character avatar'}
          data-log-exporter-avatar="true"
          style={styles.avatar}
        />
      )}
      <h1 style={styles.title}>{charInfo.name}</h1>
      <p style={styles.subtitle}>{charInfo.chatName}</p>
      <HeaderTags tags={tags} color={color} variant="default" />
    </header>
  );
};

export default React.memo(DefaultHeader);
