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

const CompactHeader: React.FC<LogHeaderProps> = ({ charInfo, color, embedImagesAsBlob, showHeaderIcon, headerTags }) => {
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
      {tags.length > 0 && (
        <div style={{
          marginTop: '0.6em', display: 'flex',
          justifyContent: 'center', gap: '5px', flexWrap: 'wrap',
        }}>
          {tags.map((tag, i) => (
            <span key={i} style={{
              background: color.cardBg, color: color.textSecondary || color.text,
              padding: '2px 8px', borderRadius: '100px',
              fontSize: '0.72em', border: `1px solid ${color.border}`,
            }}>{tag}</span>
          ))}
        </div>
      )}
    </header>
  );
};

export default CompactHeader;