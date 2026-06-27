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

const SmartHeader: React.FC<LogHeaderProps> = ({ charInfo, color, embedImagesAsBlob, showHeaderIcon, headerTags }) => {
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
      padding: '20px 0 32px',
      display: 'flex', justifyContent: 'center',
    }}>
      <div style={{
        display: 'flex', alignItems: 'center', gap: '20px',
        padding: '20px 28px',
        background: color.cardBg,
        backdropFilter: 'blur(16px) saturate(180%)',
        WebkitBackdropFilter: 'blur(16px) saturate(180%)',
        borderRadius: '20px',
        border: `1px solid ${color.border}`,
        boxShadow: '0 8px 32px rgba(0, 0, 0, 0.2)',
        maxWidth: '90%', minWidth: '280px',
      }}>
        {showHeaderIcon !== false && (
          <div style={{ position: 'relative', flexShrink: 0 }}>
            <div style={{
              position: 'absolute', top: '10%', left: '10%', right: '10%', bottom: '10%',
              background: color.nameColor, filter: 'blur(16px)',
              opacity: 0.3, borderRadius: '50%', zIndex: 0,
            }} />
            <img src={avatarSrc} data-log-exporter-avatar="true" style={{
              position: 'relative', zIndex: 1,
              width: '76px', height: '76px', borderRadius: '18px',
              objectFit: 'cover', display: 'block',
              boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
            }} />
          </div>
        )}

        <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
          <div style={{
            display: 'flex', alignItems: 'center',
            gap: '8px', flexWrap: 'wrap',
          }}>
            <h1 style={{
              margin: 0, fontSize: '1.6em',
              color: color.text, fontWeight: 700,
              letterSpacing: '-0.01em', lineHeight: 1.2,
            }}>{charInfo.name}</h1>
            <span style={{
              width: '5px', height: '5px', borderRadius: '50%',
              background: color.nameColor, opacity: 0.7,
            }} />
          </div>
          <p style={{
            margin: 0, color: color.textSecondary,
            fontSize: '0.9em', fontWeight: 500,
          }}>{charInfo.chatName}</p>
          {tags.length > 0 && (
            <div style={{ display: 'flex', gap: '5px', marginTop: '6px', flexWrap: 'wrap' }}>
              {tags.map((tag, i) => (
                <span key={i} style={{
                  fontSize: '0.72em', color: color.nameColor,
                  background: color.quoteBg,
                  padding: '3px 9px', borderRadius: '6px',
                  fontWeight: 600,
                }}>{tag}</span>
              ))}
            </div>
          )}
        </div>
      </div>
    </header>
  );
};

export default SmartHeader;