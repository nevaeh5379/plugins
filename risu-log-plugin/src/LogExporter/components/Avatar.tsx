import React, { useMemo } from 'react';
import { AVATAR_ATTR } from './constants';

/**
 * Props for the {@link Avatar} component.
 */
export interface AvatarProps {
  /** Resolved image URL or base64 data URL for the avatar. */
  avatarSrc?: string;
  /** Name of the character or participant. */
  name: string;
  /** Whether the message/avatar belongs to the user. */
  isUser: boolean;
  /** Whether rendering for Arcalive export format. */
  isForArca: boolean;
  /** Whether avatars should be displayed. If false, renders nothing. */
  showAvatar: boolean;
  /** Base CSS styles for avatar sizing, border radius, shadows, etc. */
  baseStyle: React.CSSProperties;
  /** Margin CSS styles for spacing around the avatar. */
  marginStyle: React.CSSProperties;
  /** Whether rendering for static HTML or media image export. */
  isForExport?: boolean;
}

/** Default styling for the avatar fallback placeholder container. */
const PLACEHOLDER_STYLE: React.CSSProperties = {
  backgroundColor: '#3a3f4a',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  userSelect: 'none',
  overflow: 'hidden',
};

/** Default styling for the initial letter inside the fallback placeholder. */
const INITIAL_STYLE: React.CSSProperties = {
  color: '#c0c5cf',
  fontWeight: 600,
  fontSize: '1.1em',
  lineHeight: 1,
  textTransform: 'uppercase',
};

/**
 * Derives the single-character fallback initial for an avatar.
 *
 * @param name - The participant or character name.
 * @param isUser - Whether the avatar represents the user ('U').
 * @returns The uppercase initial character, or '?' if the name is empty.
 */
function getAvatarInitial(name: string, isUser: boolean): string {
  if (isUser) {
    return 'U';
  }
  const trimmed = name?.trim();
  return trimmed && trimmed.length > 0 ? trimmed.charAt(0).toUpperCase() : '?';
}

/**
 * Renders a chat message avatar.
 *
 * Depending on the export target and availability of an image URL:
 * - **Export / Arcalive mode** (`isForArca` or `isForExport`):
 *   Renders a standard `<img>` tag with `data-user` and export attributes, or fallback initials.
 * - **Preview / Interactive mode**:
 *   Renders a `<div>` with `background-image` for crisp scaling and clipping, or fallback initials.
 * - **Hidden** (`showAvatar: false`):
 *   Renders `null`.
 */
const AvatarComponent: React.FC<AvatarProps> = ({
  avatarSrc,
  name,
  isUser,
  isForArca,
  showAvatar,
  baseStyle,
  marginStyle,
  isForExport = false,
}) => {
  // Combined style for avatar container / image
  const fullStyle: React.CSSProperties = useMemo(
    () => ({ ...baseStyle, ...marginStyle }),
    [baseStyle, marginStyle]
  );

  // Early return if avatars are globally or locally disabled
  if (!showAvatar) {
    return null;
  }

  // Common data attributes attached for DOM identification during log processing/scraping
  const avatarDataAttrs = {
    [AVATAR_ATTR]: '',
  };

  const altText = isUser ? 'User Avatar' : `${name ? name.trim() : 'Character'} Avatar`;

  // Render fallback initial placeholder when no image source is available
  const renderPlaceholder = () => {
    const initial = getAvatarInitial(name, isUser);
    return (
      <div
        {...avatarDataAttrs}
        role="img"
        aria-label={altText}
        style={{
          ...fullStyle,
          ...PLACEHOLDER_STYLE,
        }}
      >
        <span style={INITIAL_STYLE}>{initial}</span>
      </div>
    );
  };

  // 1. Export mode (Arcalive or static HTML/image export): render <img> tag
  if (isForArca || isForExport) {
    if (!avatarSrc) {
      return renderPlaceholder();
    }
    return (
      <img
        {...avatarDataAttrs}
        data-user={isUser}
        src={avatarSrc}
        alt={altText}
        style={fullStyle}
        loading="lazy"
        decoding="async"
      />
    );
  }

  // 2. Interactive Preview mode: render <div> with background image
  if (avatarSrc) {
    return (
      <div
        {...avatarDataAttrs}
        role="img"
        aria-label={altText}
        style={{
          ...fullStyle,
          backgroundImage: `url('${avatarSrc}')`,
          backgroundSize: 'cover',
          backgroundPosition: 'center',
          backgroundRepeat: 'no-repeat',
        }}
      />
    );
  }

  // 3. Fallback when no avatar image is available
  return renderPlaceholder();
};

const Avatar = React.memo(AvatarComponent);
Avatar.displayName = 'Avatar';

export { Avatar };
export default Avatar;