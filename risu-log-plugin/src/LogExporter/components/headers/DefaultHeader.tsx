import React from 'react';
import type { LogHeaderProps } from '../../../types';
import { useAvatarBlob, useParsedTags } from '../../hooks/useHeaderHelpers';
import HeaderTags from './HeaderTags';

const DefaultHeader: React.FC<LogHeaderProps> = ({ charInfo, color, embedImagesAsBlob, showHeaderIcon, headerTags }) => {
  const avatarSrc = useAvatarBlob(charInfo.avatarUrl, embedImagesAsBlob);
  const tags = useParsedTags(headerTags);

  return (
    <header style={{
      textAlign: 'center',
      paddingBottom: '1.2em',
      marginBottom: '1.8em',
      borderBottom: `1px solid ${color.border}`,
    }}>
      {showHeaderIcon !== false && (
        <img src={avatarSrc} data-log-exporter-avatar="true" style={{
          width: '72px', height: '72px', borderRadius: '50%',
          objectFit: 'cover', margin: '0 auto 0.8em', display: 'block',
          border: `2px solid ${color.avatarBorder}`,
          boxShadow: color.shadow,
        }} />
      )}
      <h1 style={{
        color: color.nameColor, margin: '0 0 0.2em 0',
        fontSize: '1.6em', fontWeight: 700, letterSpacing: '-0.01em',
      }}>{charInfo.name}</h1>
      <p style={{
        color: color.textSecondary || color.text, opacity: 0.8,
        margin: 0, fontSize: '0.88em',
      }}>{charInfo.chatName}</p>
      <HeaderTags tags={tags} color={color} />
    </header>
  );
};

export default DefaultHeader;
