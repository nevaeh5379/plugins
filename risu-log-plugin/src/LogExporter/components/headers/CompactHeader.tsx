import React from 'react';
import type { LogHeaderProps } from '../../../types';
import { useAvatarBlob, useParsedTags } from '../../hooks/useHeaderHelpers';
import HeaderTags from './HeaderTags';

const CompactHeader: React.FC<LogHeaderProps> = ({ charInfo, color, embedImagesAsBlob, showHeaderIcon, headerTags }) => {
  const avatarSrc = useAvatarBlob(charInfo.avatarUrl, embedImagesAsBlob);
  const tags = useParsedTags(headerTags);

  return (
    <header style={{
      paddingBottom: '0.8em',
      marginBottom: '1.2em',
      borderBottom: `1px solid ${color.border}`,
    }}>
      <div style={{
        display: 'flex', alignItems: 'center',
        justifyContent: 'center', gap: '12px',
      }}>
        {showHeaderIcon !== false && (
          <img src={avatarSrc} data-log-exporter-avatar="true" style={{
            width: '44px', height: '44px', borderRadius: '50%',
            objectFit: 'cover', border: `2px solid ${color.avatarBorder}`,
            boxShadow: color.shadow,
          }} />
        )}
        <div style={{ textAlign: 'left' }}>
          <h1 style={{
            color: color.nameColor, margin: 0,
            fontSize: '1.3em', fontWeight: 700,
          }}>{charInfo.name}</h1>
          <p style={{
            color: color.textSecondary || color.text, opacity: 0.7,
            margin: 0, fontSize: '0.8em',
          }}>{charInfo.chatName}</p>
        </div>
      </div>
      <HeaderTags tags={tags} color={color} variant="compact" />
    </header>
  );
};

export default CompactHeader;
