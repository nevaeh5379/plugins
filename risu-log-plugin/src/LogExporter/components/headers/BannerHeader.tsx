import React, { useEffect, useState } from 'react';
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
  headerBannerAlign?: number;
  isForExport?: boolean;
  isForArca?: boolean;
}

const BannerHeader: React.FC<LogHeaderProps> = ({
  charInfo, color, embedImagesAsBlob, showHeaderIcon, headerTags,
  headerBannerUrl, headerBannerBlur = true, headerBannerAlign = 50,
  isForExport, isForArca,
}) => {
  const [avatarSrc, setAvatarSrc] = useState(charInfo.avatarUrl);
  const [bannerSrc, setBannerSrc] = useState(headerBannerUrl || charInfo.avatarUrl);

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
        const sourceUrl = headerBannerUrl || charInfo.avatarUrl;
        if (sourceUrl) {
          try {
            const blobUrl = await imageUrlToBlob(sourceUrl);
            setBannerSrc(blobUrl);
          } catch (e) {
            console.error('[log plugin] Failed to convert banner to blob:', sourceUrl, e);
            showWarning(`배너 변환 실패: ${sourceUrl.substring(0, 80)}${sourceUrl.length > 80 ? '...' : ''}`);
          }
        }
      }
    };
    convertImages();
  }, [charInfo.avatarUrl, headerBannerUrl, embedImagesAsBlob]);

  useEffect(() => {
    setBannerSrc(headerBannerUrl || charInfo.avatarUrl);
  }, [headerBannerUrl, charInfo.avatarUrl]);

  const finalBannerSrc = embedImagesAsBlob ? bannerSrc : (headerBannerUrl || charInfo.avatarUrl);
  const tags = headerTags ? headerTags.split(',').map(t => t.trim()).filter(Boolean) : [];

  if (isForArca) {
    const divStyles: React.CSSProperties = {
      position: 'relative', display: 'flex', alignItems: 'center',
      gap: '18px', padding: '20px',
      marginBottom: '1.5em', borderRadius: '10px',
      color: 'rgb(255, 255, 255)', overflow: 'hidden',
      backgroundSize: 'cover', backgroundPosition: `center ${headerBannerAlign}%`,
    };
    if (finalBannerSrc) {
      const brightness = headerBannerBlur ? '0.55' : '0.65';
      const overlayColor = `rgba(0, 0, 0, ${1 - parseFloat(brightness)})`;
      divStyles.backgroundImage = `linear-gradient(${overlayColor}, ${overlayColor}), url("${finalBannerSrc}")`;
    } else {
      divStyles.backgroundImage = `linear-gradient(135deg, ${color.cardBg}, ${color.background})`;
    }
    return (
      <div style={divStyles} data-is-banner-header="true">
        {showHeaderIcon !== false && (
          <img src={avatarSrc} data-log-exporter-avatar="true" style={{
            width: '82px', height: '82px', borderRadius: '50%',
            objectFit: 'cover', border: `3px solid ${color.avatarBorder}`,
            boxShadow: '0 2px 10px rgba(0,0,0,0.4)', flexShrink: 0,
          }} alt="Avatar" />
        )}
        <div style={{ textAlign: 'left' }}>
          <h1 style={{
            color: '#fff', textShadow: '0 1px 4px rgba(0,0,0,0.8)',
            margin: '0 0 0.2em 0', fontSize: '1.8em', fontWeight: 700,
          }}>{charInfo.name}</h1>
          <p style={{ opacity: 0.85, margin: '0 0 0.8em 0', fontSize: '0.95em' }}>{charInfo.chatName}</p>
          {tags.length > 0 && (
            <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
              {tags.map((tag, i) => (
                <span key={i} style={{
                  background: 'rgba(0,0,0,0.4)', color: '#fff',
                  padding: '4px 10px', borderRadius: '100px',
                  fontSize: '0.78em', border: '1px solid rgba(255,255,255,0.2)',
                }}>{tag}</span>
              ))}
            </div>
          )}
        </div>
      </div>
    );
  }

  const bannerImageStyles: React.CSSProperties = {
    width: '100%', height: '100%',
    objectFit: 'cover', objectPosition: `center ${headerBannerAlign}%`,
    filter: headerBannerBlur ? 'blur(2px) brightness(0.55)' : 'brightness(0.65)',
  };

  return (
    <header style={{
      position: 'relative', display: 'flex', alignItems: 'center',
      gap: '18px', padding: '20px',
      marginBottom: '1.5em', borderRadius: '10px',
      color: '#fff', overflow: 'hidden',
    }}>
      <div style={{
        position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
        zIndex: 1, transform: 'scale(1.05)',
      }}>
        {isForExport && finalBannerSrc ? (
          <img src={finalBannerSrc} style={bannerImageStyles} alt="Banner" />
        ) : (
          <div style={{
            ...bannerImageStyles,
            backgroundImage: finalBannerSrc ? `url(${finalBannerSrc})` : `linear-gradient(135deg, ${color.cardBg}, ${color.background})`,
            backgroundSize: 'cover', backgroundPosition: `center ${headerBannerAlign}%`,
          }} />
        )}
      </div>
      <div style={{
        position: 'relative', zIndex: 2,
        display: 'flex', alignItems: 'center', gap: '18px', width: '100%',
      }}>
        {showHeaderIcon !== false && (
          <img src={avatarSrc} data-log-exporter-avatar="true" style={{
            width: '82px', height: '82px', borderRadius: '50%',
            objectFit: 'cover', border: `3px solid ${color.avatarBorder}`,
            boxShadow: '0 2px 10px rgba(0,0,0,0.4)', flexShrink: 0,
          }} alt="Avatar" />
        )}
        <div style={{ textAlign: 'left' }}>
          <h1 style={{
            color: '#fff', textShadow: '0 1px 4px rgba(0,0,0,0.8)',
            margin: '0 0 0.2em 0', fontSize: '1.8em', fontWeight: 700,
          }}>{charInfo.name}</h1>
          <p style={{ opacity: 0.85, margin: '0 0 0.8em 0', fontSize: '0.95em' }}>{charInfo.chatName}</p>
          {tags.length > 0 && (
            <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
              {tags.map((tag, i) => (
                <span key={i} style={{
                  background: 'rgba(0,0,0,0.4)', color: '#fff',
                  padding: '4px 10px', borderRadius: '100px',
                  fontSize: '0.78em', border: '1px solid rgba(255,255,255,0.2)',
                }}>{tag}</span>
              ))}
            </div>
          )}
        </div>
      </div>
    </header>
  );
};

export default BannerHeader;