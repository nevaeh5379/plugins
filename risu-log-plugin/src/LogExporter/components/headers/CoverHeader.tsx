import React, { useState, useEffect } from 'react';
import type { CharInfo, ColorPalette } from '../../../types';
import { imageUrlToBlob } from '../../utils/imageUtils';
import { showWarning } from '../../utils/notify';

interface LogHeaderProps {
  charInfo: CharInfo;
  color: ColorPalette;
  embedImagesAsBlob: boolean;
  showHeaderIcon?: boolean;
  headerTags?: string;
  headerBannerUrl?: string;
  headerBannerBlur?: boolean;
}

const CoverHeader: React.FC<LogHeaderProps> = ({
  charInfo, color, embedImagesAsBlob, showHeaderIcon, headerTags,
  headerBannerUrl, headerBannerBlur,
}) => {
  const [avatarSrc, setAvatarSrc] = useState(charInfo.avatarUrl);
  const [bannerSrc, setBannerSrc] = useState<string | null>(headerBannerUrl || null);

  useEffect(() => {
    const convertImages = async () => {
      if (embedImagesAsBlob) {
        if (charInfo.avatarUrl) {
          try {
            const blobUrl = await imageUrlToBlob(charInfo.avatarUrl);
            setAvatarSrc(blobUrl);
          } catch (e) {
            console.error('[log plugin] Failed to convert avatar to blob:', charInfo.avatarUrl, e);
            showWarning(`아바타 변환 실패: ${charInfo.avatarUrl.substring(0, 80)}${charInfo.avatarUrl.length > 80 ? '...' : ''}`);
          }
        }
        if (headerBannerUrl) {
          try {
            const blobUrl = await imageUrlToBlob(headerBannerUrl);
            setBannerSrc(blobUrl);
          } catch (e) {
            console.error('[log plugin] Failed to convert banner to blob:', headerBannerUrl, e);
            showWarning(`배너 변환 실패: ${headerBannerUrl.substring(0, 80)}${headerBannerUrl.length > 80 ? '...' : ''}`);
          }
        }
      }
    };
    convertImages();
  }, [charInfo.avatarUrl, headerBannerUrl, embedImagesAsBlob]);

  const tags = headerTags ? headerTags.split(',').map(t => t.trim()).filter(Boolean) : [];

  const backgroundStyle: React.CSSProperties = {
    backgroundImage: `url(${bannerSrc || avatarSrc})`,
    backgroundSize: 'cover', backgroundPosition: 'center',
    filter: headerBannerBlur ? 'blur(6px)' : 'none',
    opacity: 0.9,
  };

  return (
    <header style={{
      marginBottom: '3em', position: 'relative',
      backgroundColor: color.background,
    }}>
      <div style={{
        height: '240px', width: '100%',
        position: 'relative', overflow: 'hidden',
        backgroundColor: '#333',
      }}>
        <div style={{
          position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
          ...backgroundStyle,
        }} />
        <div style={{
          position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
          background: 'linear-gradient(to bottom, transparent 50%, rgba(0,0,0,0.6) 100%)',
        }} />
      </div>

      <div style={{
        maxWidth: '900px', margin: '0 auto',
        position: 'relative', padding: '0 28px',
        display: 'flex', alignItems: 'flex-end', gap: '20px',
        marginTop: '-44px', pointerEvents: 'none',
      }}>
        {showHeaderIcon !== false && (
          <div style={{ flexShrink: 0, position: 'relative', pointerEvents: 'auto' }}>
            <img src={avatarSrc} data-log-exporter-avatar="true" style={{
              width: '140px', height: '140px', borderRadius: '14px',
              objectFit: 'cover', border: `4px solid ${color.background}`,
              boxShadow: '0 4px 12px rgba(0,0,0,0.2)',
              backgroundColor: color.cardBg,
            }} />
          </div>
        )}

        <div style={{
          flex: 1, paddingBottom: '14px',
          pointerEvents: 'auto',
          display: 'flex', alignItems: 'flex-end',
          justifyContent: 'space-between', gap: '16px', flexWrap: 'wrap',
        }}>
          <div style={{ position: 'relative' }}>
            <h1 style={{
              margin: 0, fontSize: '2em', fontWeight: 800,
              color: color.text,
              textShadow: '0 2px 8px rgba(0,0,0,0.3)',
              lineHeight: 1, position: 'relative', zIndex: 1,
            }}>
              {charInfo.name}
              <span style={{
                position: 'absolute', bottom: '2px', left: 0,
                width: '100%', height: '6px',
                background: color.nameColor, opacity: 0.25,
                zIndex: -1, borderRadius: '3px',
              }} />
            </h1>
          </div>

          <div style={{
            display: 'flex', flexDirection: 'column',
            alignItems: 'flex-end', gap: '5px',
          }}>
            <p style={{
              margin: 0, fontSize: '0.9em',
              color: color.text, fontWeight: 600,
              background: color.cardBg,
              padding: '3px 10px', borderRadius: '100px',
              border: `1px solid ${color.border}`,
            }}>{charInfo.chatName}</p>
            {tags.length > 0 && (
              <div style={{
                display: 'flex', gap: '5px',
                flexWrap: 'wrap', justifyContent: 'flex-end',
              }}>
                {tags.map((tag, i) => (
                  <span key={i} style={{
                    fontSize: '0.72em', padding: '2px 7px',
                    borderRadius: '4px', border: `1px solid ${color.border}`,
                    color: color.textSecondary, opacity: 0.8,
                  }}>{tag}</span>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </header>
  );
};

export default CoverHeader;