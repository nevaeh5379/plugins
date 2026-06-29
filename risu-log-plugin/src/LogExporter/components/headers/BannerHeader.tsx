import React from 'react';
import type { LogHeaderProps } from '../../../types';
import { useMultiImageBlob, useParsedTags } from '../../hooks/useHeaderHelpers';
import HeaderTags from './HeaderTags';

const BannerHeader: React.FC<LogHeaderProps> = ({
  charInfo, color, embedImagesAsBlob, showHeaderIcon, headerTags,
  headerBannerUrl, headerBannerBlur = true, headerBannerAlign = 50,
  isForExport, isForArca,
}) => {
  const bannerSourceUrl = headerBannerUrl || charInfo.avatarUrl;
  const [avatarSrc, bannerSrc] = useMultiImageBlob(
    [charInfo.avatarUrl, bannerSourceUrl],
    embedImagesAsBlob
  );
  const tags = useParsedTags(headerTags);

  const finalBannerSrc = embedImagesAsBlob ? bannerSrc : bannerSourceUrl;

  // Shared content for avatar + name section
  const renderContentSection = () => (
    <>
      {showHeaderIcon !== false && (
        <img src={avatarSrc} data-log-exporter-avatar="true" style={{
          width: '82px', height: '82px', borderRadius: '50%',
          objectFit: 'cover',
          boxShadow: '0 2px 10px rgba(0,0,0,0.4)', flexShrink: 0,
           objectPosition: 'top',
        }} alt="Avatar" />
      )}
      <div style={{ textAlign: 'left' }}>
        <h1 style={{
          color: '#fff', textShadow: '0 1px 4px rgba(0,0,0,0.8)',
          margin: '0 0 0.2em 0', fontSize: '1.8em', fontWeight: 700,
          objectPosition: 'top',
        }}>{charInfo.name}</h1>
        <p style={{ opacity: 0.85, margin: '0 0 0.8em 0', fontSize: '0.95em' }}>{charInfo.chatName}</p>
        <HeaderTags tags={tags} color={color} variant="banner" />
      </div>
    </>
  );

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
        {renderContentSection()}
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
        {renderContentSection()}
      </div>
    </header>
  );
};

export default BannerHeader;
