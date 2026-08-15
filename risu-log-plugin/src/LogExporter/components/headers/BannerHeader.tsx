import React, { useMemo } from 'react';
import type { LogHeaderProps, ColorPalette } from '../../../types';
import { useMultiImageBlob, useParsedTags } from '../../hooks/useHeaderHelpers';
import HeaderTags from './HeaderTags';

/**
 * Generates inline style definitions for the ArcaLive single-layer export container.
 *
 * Combines darkened linear-gradient overlays and the banner background image directly
 * on a single element for maximum compatibility with external forum post processors.
 */
function createArcaContainerStyles(
  color: ColorPalette,
  bannerSrc: string | undefined,
  bannerAlign: number,
  bannerBlur: boolean
): React.CSSProperties {
  const styles: React.CSSProperties = {
    position: 'relative',
    display: 'flex',
    alignItems: 'center',
    gap: '18px',
    padding: '20px',
    marginBottom: '1.5em',
    borderRadius: '10px',
    color: 'rgb(255, 255, 255)',
    overflow: 'hidden',
    backgroundSize: 'cover',
    backgroundPosition: `center ${bannerAlign}%`,
  };

  if (bannerSrc) {
    const brightness = bannerBlur ? '0.55' : '0.65';
    const overlayAlpha = (1 - parseFloat(brightness)).toString();
    const overlayColor = `rgba(0, 0, 0, ${overlayAlpha})`;
    styles.backgroundImage = `linear-gradient(${overlayColor}, ${overlayColor}), url("${bannerSrc}")`;
  } else {
    styles.backgroundImage = `linear-gradient(135deg, ${color.cardBg}, ${color.background})`;
  }

  return styles;
}

/**
 * Generates style definitions for the standard layered banner header.
 */
function createBannerHeaderStyles(
  color: ColorPalette,
  bannerSrc: string | undefined,
  bannerAlign: number,
  bannerBlur: boolean
) {
  const filter = bannerBlur ? 'blur(2px) brightness(0.55)' : 'brightness(0.65)';

  return {
    header: {
      position: 'relative',
      display: 'flex',
      alignItems: 'center',
      gap: '18px',
      padding: '20px',
      marginBottom: '1.5em',
      borderRadius: '10px',
      color: '#fff',
      overflow: 'hidden',
    } as const satisfies React.CSSProperties,

    backdropWrapper: {
      position: 'absolute',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      zIndex: 1,
      transform: 'scale(1.05)',
    } as const satisfies React.CSSProperties,

    bannerImage: {
      width: '100%',
      height: '100%',
      objectFit: 'cover',
      objectPosition: `center ${bannerAlign}%`,
      filter,
    } as const satisfies React.CSSProperties,

    bannerDiv: {
      width: '100%',
      height: '100%',
      objectFit: 'cover',
      objectPosition: `center ${bannerAlign}%`,
      filter,
      backgroundImage: bannerSrc
        ? `url("${bannerSrc}")`
        : `linear-gradient(135deg, ${color.cardBg}, ${color.background})`,
      backgroundSize: 'cover',
      backgroundPosition: `center ${bannerAlign}%`,
    } as const satisfies React.CSSProperties,

    foreground: {
      position: 'relative',
      zIndex: 2,
      display: 'flex',
      alignItems: 'center',
      gap: '18px',
      width: '100%',
    } as const satisfies React.CSSProperties,
  };
}

/**
 * Static style definitions for character profile elements within the banner.
 */
const PROFILE_STYLES = {
  avatar: {
    width: '82px',
    height: '82px',
    borderRadius: '50%',
    objectFit: 'cover',
    boxShadow: '0 2px 10px rgba(0,0,0,0.4)',
    flexShrink: 0,
  } as const satisfies React.CSSProperties,

  infoContainer: {
    textAlign: 'left',
  } as const satisfies React.CSSProperties,

  nameTitle: {
    color: '#fff',
    textShadow: '0 1px 4px rgba(0,0,0,0.8)',
    margin: '0 0 0.2em 0',
    fontSize: '1.8em',
    fontWeight: 700,
  } as const satisfies React.CSSProperties,

  chatSubtitle: {
    opacity: 0.85,
    margin: '0 0 0.8em 0',
    fontSize: '0.95em',
  } as const satisfies React.CSSProperties,
};

/**
 * Props for internal banner profile content section.
 */
interface BannerProfileContentProps {
  avatarSrc: string;
  charName: string;
  chatName: string;
  showHeaderIcon: boolean;
  tags: string[];
  color: ColorPalette;
}

/**
 * Internal sub-component rendering avatar image, character title, chat subtitle, and banner tags.
 */
const BannerProfileContent: React.FC<BannerProfileContentProps> = ({
  avatarSrc,
  charName,
  chatName,
  showHeaderIcon,
  tags,
  color,
}) => (
  <>
    {showHeaderIcon && (
      <img
        src={avatarSrc}
        data-log-exporter-avatar="true"
        style={PROFILE_STYLES.avatar}
        alt={charName ? `${charName} avatar` : 'Avatar'}
      />
    )}
    <div style={PROFILE_STYLES.infoContainer}>
      <h1 style={PROFILE_STYLES.nameTitle}>{charName}</h1>
      <p style={PROFILE_STYLES.chatSubtitle}>{chatName}</p>
      <HeaderTags tags={tags} color={color} variant="banner" />
    </div>
  </>
);

/**
 * BannerHeader renders a rich hero banner header for exported chat logs.
 *
 * Visual & Functional Features:
 * - Wide banner backdrop using custom banner URL or character avatar as fallback
 * - Configurable backdrop blur filter (`headerBannerBlur`) and vertical positioning (`headerBannerAlign`)
 * - Slight overscale (`scale(1.05)`) on the backdrop layer to prevent blur bleed at rounded borders
 * - HTML-to-image export optimization (`isForExport`) using `<img>` tags for reliable canvas rasterization
 * - Single-layer ArcaLive export mode (`isForArca`) for compatible forum post formatting
 * - High-contrast white typography with soft text shadows for readability over arbitrary images
 */
export const BannerHeader: React.FC<LogHeaderProps> = React.memo(({
  charInfo,
  color,
  embedImagesAsBlob = false,
  showHeaderIcon = true,
  headerTags,
  headerBannerUrl,
  headerBannerBlur = true,
  headerBannerAlign = 50,
  isForExport = false,
  isForArca = false,
}) => {
  const bannerSourceUrl = headerBannerUrl || charInfo.avatarUrl;
  const [avatarBlob, bannerBlob] = useMultiImageBlob(
    [charInfo.avatarUrl, bannerSourceUrl],
    embedImagesAsBlob
  );
  const tags = useParsedTags(headerTags);

  // Resolve active image sources with fallbacks for initial loading or blob failure
  const resolvedAvatarSrc = avatarBlob || charInfo.avatarUrl;
  const resolvedBannerSrc = embedImagesAsBlob
    ? (bannerBlob || bannerSourceUrl)
    : bannerSourceUrl;

  const showIcon = showHeaderIcon !== false;

  // Memoized style configurations
  const arcaStyles = useMemo(
    () => (isForArca ? createArcaContainerStyles(color, resolvedBannerSrc, headerBannerAlign, headerBannerBlur) : null),
    [isForArca, color, resolvedBannerSrc, headerBannerAlign, headerBannerBlur]
  );

  const standardStyles = useMemo(
    () => (!isForArca ? createBannerHeaderStyles(color, resolvedBannerSrc, headerBannerAlign, headerBannerBlur) : null),
    [isForArca, color, resolvedBannerSrc, headerBannerAlign, headerBannerBlur]
  );

  // Arca export mode: Single-layer container with combined gradient background
  if (isForArca && arcaStyles) {
    return (
      <div style={arcaStyles} data-is-banner-header="true">
        <BannerProfileContent
          avatarSrc={resolvedAvatarSrc}
          charName={charInfo.name}
          chatName={charInfo.chatName}
          showHeaderIcon={showIcon}
          tags={tags}
          color={color}
        />
      </div>
    );
  }

  if (!standardStyles) {
    return null;
  }

  return (
    <header style={standardStyles.header}>
      {/* Background Banner Layer */}
      <div style={standardStyles.backdropWrapper}>
        {isForExport && resolvedBannerSrc ? (
          <img
            src={resolvedBannerSrc}
            style={standardStyles.bannerImage}
            alt="Banner"
          />
        ) : (
          <div style={standardStyles.bannerDiv} />
        )}
      </div>

      {/* Foreground Profile Content */}
      <div style={standardStyles.foreground}>
        <BannerProfileContent
          avatarSrc={resolvedAvatarSrc}
          charName={charInfo.name}
          chatName={charInfo.chatName}
          showHeaderIcon={showIcon}
          tags={tags}
          color={color}
        />
      </div>
    </header>
  );
});

BannerHeader.displayName = 'BannerHeader';

export default BannerHeader;
