import React from 'react';
import type { LogHeaderProps } from '../../../types';
import { useMultiImageBlob, useParsedTags } from '../../hooks/useHeaderHelpers';
import HeaderTags from './HeaderTags';

const CoverHeader: React.FC<LogHeaderProps> = ({
  charInfo, color, embedImagesAsBlob, showHeaderIcon, headerTags,
  headerBannerUrl, headerBannerBlur,
}) => {
  const [avatarSrc, bannerSrc] = useMultiImageBlob(
    [charInfo.avatarUrl, headerBannerUrl || ''],
    embedImagesAsBlob
  );
  const tags = useParsedTags(headerTags);

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
               objectPosition: 'top',
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
            <HeaderTags tags={tags} color={color} variant="cover" />
          </div>
        </div>
      </div>
    </header>
  );
};

export default CoverHeader;
