import React, { useMemo } from 'react';
import type { MessageProps, ColorPalette } from '../../../types';
import Avatar from '../Avatar';
import { useMessageCard } from './useMessageCard';
import type { ThemeConfig } from './BaseMessage';

/**
 * Configuration object representing the "Smart" message theme specifications.
 * Defines dimensional and layout constants for the Smart theme.
 */
const smartThemeConfig: ThemeConfig = {
  // Layout
  marginBottom: 20,
  flexDirection: 'row',
  gap: 4,
  containerPaddingX: 4,

  // Avatar
  avatarSize: 40,
  avatarRadius: '50%',
  avatarBorder: false,
  avatarMargin: 10,

  // Name (displayed above card for character messages)
  showName: true,
  nameFontSize: 0.88,
  nameMarginBottom: 4,
  nameOpacity: 0.85,
  nameShowForUser: false,

  // Card mode
  renderMode: 'card',
  cardBorderRadius: '4px 16px 16px 16px',
  cardBorderRadiusUser: '16px 4px 16px 16px',
  cardPaddingX: 14,
  cardPaddingY: 10,
  cardShadow: '0 2px 12px rgba(0, 0, 0, 0.06)',
  cardBackdropFilter: true,
  nameInHeader: false,

  // Shared typography
  lineHeight: 1.7,

  // Delete button placement
  deleteButtonPlacement: 'inAvatar',
  deleteButtonOpposite: true,
  deleteButtonStyle: {
    width: '18px',
    height: '18px',
    fontSize: '12px',
    top: '-5px',
  },
};

interface SmartMessageStyleParams {
  color: ColorPalette;
  isUser: boolean;
  baseSize: string;
}

/**
 * Factory for computing glassmorphism styles in the Smart theme.
 * Encapsulates backdrop filter blur, asymmetric card curvature, and responsive colors.
 */
function createSmartMessageStyles({ color, isUser, baseSize }: SmartMessageStyleParams) {
  const cardBg = isUser ? color.cardBgUser : color.cardBg;
  const borderRadius = isUser
    ? smartThemeConfig.cardBorderRadiusUser || '16px 4px 16px 16px'
    : smartThemeConfig.cardBorderRadius || '4px 16px 16px 16px';

  return {
    container: {
      position: 'relative',
      display: 'flex',
      alignItems: 'flex-start',
      marginBottom: `${smartThemeConfig.marginBottom}px`,
      gap: `${smartThemeConfig.gap ?? 4}px`,
      flexDirection: isUser ? 'row-reverse' : 'row',
      padding: `0 ${smartThemeConfig.containerPaddingX ?? 4}px`,
    } as const satisfies React.CSSProperties,

    avatarWrapper: {
      position: 'relative',
      flexShrink: 0,
    } as const satisfies React.CSSProperties,

    avatarBase: {
      width: smartThemeConfig.avatarSize,
      height: smartThemeConfig.avatarSize,
      minWidth: smartThemeConfig.avatarSize,
      borderRadius: smartThemeConfig.avatarRadius,
      border: smartThemeConfig.avatarBorder ? `1px solid ${color.avatarBorder}` : 'none',
      boxShadow: color.shadow || '0 2px 8px rgba(0, 0, 0, 0.15)',
    } as const satisfies React.CSSProperties,

    avatarMargin: {
      margin: isUser
        ? `0 0 0 ${smartThemeConfig.avatarMargin}px`
        : `0 ${smartThemeConfig.avatarMargin}px 0 0`,
    } as const satisfies React.CSSProperties,

    deleteButton: {
      position: 'absolute',
      top: '-5px',
      right: isUser ? 'auto' : '-5px',
      left: isUser ? '-5px' : 'auto',
      width: '18px',
      height: '18px',
      fontSize: '12px',
      lineHeight: '14px',
      padding: 0,
      border: 'none',
      borderRadius: '50%',
      backgroundColor: 'rgba(200, 50, 50, 0.75)',
      color: '#ffffff',
      cursor: 'pointer',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 10,
      boxShadow: '0 2px 4px rgba(0, 0, 0, 0.2)',
      ...smartThemeConfig.deleteButtonStyle,
    } as const satisfies React.CSSProperties,

    contentColumn: {
      display: 'flex',
      flexDirection: 'column',
      alignItems: isUser ? 'flex-end' : 'flex-start',
      maxWidth: '85%',
      minWidth: 0,
    } as const satisfies React.CSSProperties,

    characterName: {
      color: color.nameColor,
      fontWeight: 600,
      fontSize: `calc(${baseSize} * ${smartThemeConfig.nameFontSize})`,
      marginBottom: `${smartThemeConfig.nameMarginBottom}px`,
      marginLeft: '6px',
      opacity: smartThemeConfig.nameOpacity,
      letterSpacing: '0.01em',
    } as const satisfies React.CSSProperties,

    glassCard: {
      borderRadius,
      background: cardBg,
      boxShadow: smartThemeConfig.cardShadow || color.shadow || '0 2px 12px rgba(0, 0, 0, 0.06)',
      overflow: 'hidden',
      backdropFilter: 'blur(12px) saturate(180%)',
      WebkitBackdropFilter: 'blur(12px) saturate(180%)',
      border: `1px solid ${color.border}`,
      transition: 'box-shadow 0.2s ease, border-color 0.2s ease',
    } as const satisfies React.CSSProperties,

    messageContent: {
      padding: `${smartThemeConfig.cardPaddingY ?? 10}px ${smartThemeConfig.cardPaddingX ?? 14}px`,
      color: color.text,
      lineHeight: smartThemeConfig.lineHeight,
      wordWrap: 'break-word',
      overflowWrap: 'anywhere',
      fontSize: baseSize,
    } as const satisfies React.CSSProperties,
  };
}

/**
 * SmartMessage - Glassmorphism floating-card message component for the "Smart" theme.
 *
 * Key Design Features:
 * - Frosted glass effect with backdrop blur (12px) and saturation enhancement.
 * - Direction-aware asymmetrical border radii (pointed towards speaker's avatar).
 * - Floating character name header placed cleanly above the card for non-user messages.
 * - Integrated avatar with avatar-anchored deletion button in edit mode.
 * - Fully accessible contentEditable support with change propagation on blur.
 */
export const SmartMessage: React.FC<MessageProps> = (props) => {
  const {
    charInfoName,
    color,
    showAvatar,
    isForArca,
    isForExport,
    isEditable,
    index,
  } = props;

  const {
    baseSize,
    messageHtml,
    contentRef,
    isUser,
    name,
    avatarSrc,
    handleBlur,
    handleContentClick,
  } = useMessageCard(props);

  const styles = useMemo(
    () => createSmartMessageStyles({ color, isUser, baseSize }),
    [color, isUser, baseSize]
  );

  // Early return for empty messages
  if (!messageHtml || messageHtml.trim().length === 0) {
    return null;
  }

  return (
    <div className="chat-message-container" style={styles.container}>
      {/* Avatar Section with overlay delete button */}
      <div style={styles.avatarWrapper}>
        <Avatar
          avatarSrc={avatarSrc}
          name={charInfoName}
          isUser={isUser}
          isForArca={isForArca}
          showAvatar={showAvatar}
          baseStyle={styles.avatarBase}
          marginStyle={styles.avatarMargin}
          isForExport={isForExport}
        />
        {isEditable && (
          <button
            type="button"
            className="log-exporter-delete-msg-btn"
            data-message-index={index}
            title="메시지 삭제"
            style={styles.deleteButton}
          >
            &times;
          </button>
        )}
      </div>

      {/* Message Column: Character Name + Glassmorphic Card */}
      <div style={styles.contentColumn}>
        {/* Name is displayed above the card for character messages only */}
        {!isUser && (
          <span style={styles.characterName}>{name}</span>
        )}

        <div style={styles.glassCard}>
          <div
            ref={contentRef}
            style={styles.messageContent}
            contentEditable={isEditable}
            onBlur={handleBlur}
            onClick={handleContentClick}
            suppressContentEditableWarning={true}
          />
        </div>
      </div>
    </div>
  );
};

SmartMessage.displayName = 'SmartMessage';

export default SmartMessage;
