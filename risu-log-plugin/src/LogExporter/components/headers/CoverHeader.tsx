import React, { useMemo } from 'react';
import type { LogHeaderProps } from '../../../types';
import { useMultiImageBlob, useParsedTags } from '../../hooks/useHeaderHelpers';
import HeaderTags from './HeaderTags';

/**
 * CoverHeader renders a full-width hero cover header for exported chat logs.
 *
 * Visual layout:
 * - 240px hero banner backdrop with optional blur and bottom gradient overlay
 * - Large 140px square avatar overlapping the lower edge of the banner
 * - Prominent character name with an accent-colored underline highlight
 * - Pill-styled chat session badge and cover-variant tags
 */
const CoverHeader: React.FC<LogHeaderProps> = ({
  charInfo,
  color,
  embedImagesAsBlob,
  showHeaderIcon = true,
  headerTags,
  headerBannerUrl,
  headerBannerBlur = false,
  headerBannerAlign = 50,
}) => {
  // Concurrently resolve Data URL blobs for avatar and banner when blob embedding is enabled
  const bannerSource = headerBannerUrl || '';
  const [avatarBlob, bannerBlob] = useMultiImageBlob(
    [charInfo.avatarUrl, bannerSource],
    embedImagesAsBlob
  );

  const tags = useParsedTags(headerTags);

  const avatarSrc = avatarBlob || charInfo.avatarUrl;
  const coverImageSrc = bannerBlob || headerBannerUrl || avatarSrc;

  // Background banner style with blur, positioning, and darkening overlay support
  const backgroundStyle = useMemo<React.CSSProperties>(
    () => ({
      position: 'absolute',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundImage: coverImageSrc ? `url("${coverImageSrc}")` : undefined,
      backgroundSize: 'cover',
      backgroundPosition: `center ${headerBannerAlign}%`,
      filter: headerBannerBlur ? 'blur(6px)' : 'none',
      opacity: 0.9,
      ...(headerBannerBlur ? { transform: 'scale(1.05)' } : {}),
    }),
    [coverImageSrc, headerBannerAlign, headerBannerBlur]
  );

  return (
    <header
      style={{
        marginBottom: '3em',
        position: 'relative',
        backgroundColor: color.background,
      }}
    >
      {/* Cover Banner Area */}
      <div
        style={{
          height: '240px',
          width: '100%',
          position: 'relative',
          overflow: 'hidden',
          backgroundColor: '#333',
        }}
      >
        <div style={backgroundStyle} />
        <div
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: 'linear-gradient(to bottom, transparent 50%, rgba(0,0,0,0.6) 100%)',
          }}
        />
      </div>

      {/* Foreground Profile Content */}
      <div
        style={{
          maxWidth: '900px',
          margin: '0 auto',
          position: 'relative',
          padding: '0 28px',
          display: 'flex',
          alignItems: 'flex-end',
          gap: '20px',
          marginTop: '-44px',
          pointerEvents: 'none',
        }}
      >
        {/* Overlapping Character Avatar */}
        {showHeaderIcon !== false && (
          <div
            style={{
              flexShrink: 0,
              position: 'relative',
              pointerEvents: 'auto',
            }}
          >
            <img
              src={avatarSrc}
              alt={charInfo.name ? `${charInfo.name} avatar` : 'Avatar'}
              data-log-exporter-avatar="true"
              style={{
                width: '140px',
                height: '140px',
                borderRadius: '14px',
                objectFit: 'cover',
                border: `4px solid ${color.background}`,
                boxShadow: '0 4px 12px rgba(0,0,0,0.2)',
                backgroundColor: color.cardBg,
                display: 'block',
              }}
            />
          </div>
        )}

        {/* Character Title & Metadata */}
        <div
          style={{
            flex: 1,
            paddingBottom: '14px',
            pointerEvents: 'auto',
            display: 'flex',
            alignItems: 'flex-end',
            justifyContent: 'space-between',
            gap: '16px',
            flexWrap: 'wrap',
          }}
        >
          {/* Character Name with Underline Highlight Accent */}
          <div style={{ position: 'relative' }}>
            <h1
              style={{
                margin: 0,
                fontSize: '2em',
                fontWeight: 800,
                color: color.text,
                textShadow: '0 2px 8px rgba(0,0,0,0.3)',
                lineHeight: 1,
                position: 'relative',
                zIndex: 1,
              }}
            >
              {charInfo.name}
              <span
                style={{
                  position: 'absolute',
                  bottom: '2px',
                  left: 0,
                  width: '100%',
                  height: '6px',
                  background: color.nameColor,
                  opacity: 0.25,
                  zIndex: -1,
                  borderRadius: '3px',
                }}
              />
            </h1>
          </div>

          {/* Chat Name Pill & Tags */}
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'flex-end',
              gap: '5px',
            }}
          >
            {charInfo.chatName ? (
              <p
                style={{
                  margin: 0,
                  fontSize: '0.9em',
                  color: color.text,
                  fontWeight: 600,
                  background: color.cardBg,
                  padding: '3px 10px',
                  borderRadius: '100px',
                  border: `1px solid ${color.border}`,
                }}
              >
                {charInfo.chatName}
              </p>
            ) : null}
            <HeaderTags tags={tags} color={color} variant="cover" />
          </div>
        </div>
      </div>
    </header>
  );
};

export default CoverHeader;
