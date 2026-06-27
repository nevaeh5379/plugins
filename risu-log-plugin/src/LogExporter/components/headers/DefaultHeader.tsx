import React, { useEffect, useState } from 'react';
import type { CharInfo, ColorPalette } from '../../../types';
import { imageUrlToBlob } from '../../utils/imageUtils';

interface LogHeaderProps {
  charInfo: CharInfo;
  color: ColorPalette;
  embedImagesAsBlob: boolean;
  showHeaderIcon?: boolean;
  headerTags?: string;
}

const DefaultHeader: React.FC<LogHeaderProps> = ({ charInfo, color, embedImagesAsBlob, showHeaderIcon, headerTags }) => {
  const [avatarSrc, setAvatarSrc] = useState(charInfo.avatarUrl);

  useEffect(() => {
    const convertAvatar = async () => {
      if (embedImagesAsBlob && charInfo.avatarUrl) {
        try {
          const blobUrl = await imageUrlToBlob(charInfo.avatarUrl);
          setAvatarSrc(blobUrl);
        } catch { /* ignore */ }
      }
    };
    convertAvatar();
  }, [charInfo.avatarUrl, embedImagesAsBlob]);

  const tags = headerTags ? headerTags.split(',').map(t => t.trim()).filter(Boolean) : [];

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
      {tags.length > 0 && (
        <div style={{
          marginTop: '0.8em', display: 'flex',
          justifyContent: 'center', gap: '6px', flexWrap: 'wrap',
        }}>
          {tags.map((tag, i) => (
            <span key={i} style={{
              background: color.cardBg, color: color.textSecondary || color.text,
              padding: '3px 10px', borderRadius: '100px',
              fontSize: '0.78em', border: `1px solid ${color.border}`,
            }}>{tag}</span>
          ))}
        </div>
      )}
    </header>
  );
};

export default DefaultHeader;