import React from 'react';
import type { MessageProps, ColorPalette } from '../../../types';
import Avatar from '../Avatar';
import { useMessageCard } from './useMessageCard';
import MessageCard from './MessageCard';

/**
 * Configuration contract for theme-specific message layouts and visuals.
 */
export interface ThemeConfig {
  // ── Layout & Spacing ────────────────────────────────────────────────
  marginBottom: number;
  flexDirection: 'row' | 'row-reverse';
  gap?: number;
  containerPaddingX?: number;

  // ── Avatar Styling ──────────────────────────────────────────────────
  avatarSize: number;
  avatarRadius: string | number;
  avatarBorder?: boolean;
  avatarMargin: number;

  // ── Author Name Display ─────────────────────────────────────────────
  showName: boolean;
  nameFontSize: number;
  nameMarginTop?: number;
  nameMarginBottom: number;
  nameOpacity: number;
  nameColorOverride?: boolean;
  nameShowForUser?: boolean; // When false, name only shown for non-user (e.g. SmartMessage)

  // ── Timestamp Display (Optional) ────────────────────────────────────
  showTime?: boolean;
  timeFontSize?: number;
  timeOpacity?: number;

  // ── Render Mode ─────────────────────────────────────────────────────
  renderMode?: 'bubble' | 'card';

  // ── Bubble Mode Options (renderMode === 'bubble') ───────────────────
  bubbleRadius?: string;
  bubbleRadiusUser?: string;
  bubblePaddingX?: number;
  bubblePaddingY?: number;

  // ── Non-bubble Mode Fallback (!showBubble) ──────────────────────────
  nobubblePaddingX?: number;
  nobubblePaddingY?: number;

  // ── Card Mode Options (renderMode === 'card') ───────────────────────
  cardBorderRadius?: string;
  cardBorderRadiusUser?: string;
  cardPaddingX?: number;
  cardPaddingY?: number;
  cardShadow?: string;
  cardBackdropFilter?: boolean;
  cardBorder?: boolean;
  nameInHeader?: boolean; // true = name in header bar (Modern), false = name above card (Smart)
  nameBarPaddingX?: number;
  nameBarPaddingY?: number;

  // ── Typography & Shared Options ─────────────────────────────────────
  lineHeight: number;

  // ── Actions & Delete Button ─────────────────────────────────────────
  deleteButtonPlacement: 'beforeAvatar' | 'inAvatar' | 'afterContent';
  deleteButtonStyle?: React.CSSProperties;
  deleteButtonOpposite?: boolean; // When true, button position flips based on isUser (SmartMessage)
}

export interface BaseMessageProps extends MessageProps {
  themeConfig: ThemeConfig;
}

// ─────────────────────────────────────────────────────────────────────────────
// Sub-components
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Message deletion button rendered when the log view is editable.
 */
interface DeleteButtonProps {
  index: number;
  isUser: boolean;
  placement: 'beforeAvatar' | 'inAvatar' | 'afterContent';
  customStyle?: React.CSSProperties;
  opposite?: boolean;
}

const DeleteButton: React.FC<DeleteButtonProps> = ({
  index,
  isUser,
  placement,
  customStyle,
  opposite,
}) => {
  const baseStyle: React.CSSProperties = {
    position: 'absolute',
    top: '-2px',
    right: '-2px',
    width: '16px',
    height: '16px',
    fontSize: '12px',
    lineHeight: '14px',
    padding: 0,
    border: 'none',
    borderRadius: '50%',
    backgroundColor: 'rgba(200, 50, 50, 0.7)',
    color: '#fff',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 10,
  };

  let resolvedStyle: React.CSSProperties = { ...baseStyle, ...customStyle };

  if (placement === 'inAvatar') {
    const inAvatarStyle: React.CSSProperties = opposite
      ? {
          ...baseStyle,
          right: isUser ? 'auto' : '-5px',
          left: isUser ? '-5px' : 'auto',
        }
      : baseStyle;
    resolvedStyle = { ...inAvatarStyle, ...customStyle };
  } else if (placement === 'afterContent') {
    resolvedStyle = {
      float: isUser ? 'left' : 'right',
      opacity: 0.3,
      ...customStyle,
    };
  }

  return (
    <button
      type="button"
      className="log-exporter-delete-msg-btn"
      data-message-index={index}
      title="메시지 삭제"
      style={resolvedStyle}
    >
      &times;
    </button>
  );
};

/**
 * Encapsulated avatar container that handles positioning, margins, and in-avatar delete controls.
 */
interface MessageAvatarSectionProps {
  avatarSrc?: string;
  charInfoName: string;
  isUser: boolean;
  isForArca: boolean;
  showAvatar: boolean;
  isForExport?: boolean;
  isEditable?: boolean;
  index: number;
  themeConfig: ThemeConfig;
  colorShadow?: string;
}

const MessageAvatarSection: React.FC<MessageAvatarSectionProps> = ({
  avatarSrc,
  charInfoName,
  isUser,
  isForArca,
  showAvatar,
  isForExport,
  isEditable,
  index,
  themeConfig,
  colorShadow,
}) => {
  const avatarBaseStyle: React.CSSProperties = {
    width: themeConfig.avatarSize,
    height: themeConfig.avatarSize,
    minWidth: themeConfig.avatarSize,
    borderRadius: themeConfig.avatarRadius,
    boxShadow: colorShadow || 'none',
  };

  const avatarMarginStyle: React.CSSProperties = {
    margin: isUser
      ? `0 0 0 ${themeConfig.avatarMargin}px`
      : `0 ${themeConfig.avatarMargin}px 0 0`,
  };

  return (
    <div style={{ position: 'relative', flexShrink: 0 }}>
      <Avatar
        avatarSrc={avatarSrc}
        name={charInfoName}
        isUser={isUser}
        isForArca={isForArca}
        showAvatar={showAvatar}
        baseStyle={avatarBaseStyle}
        marginStyle={avatarMarginStyle}
        isForExport={isForExport}
      />
      {isEditable && themeConfig.deleteButtonPlacement === 'inAvatar' && (
        <DeleteButton
          index={index}
          isUser={isUser}
          placement="inAvatar"
          customStyle={themeConfig.deleteButtonStyle}
          opposite={themeConfig.deleteButtonOpposite}
        />
      )}
    </div>
  );
};

/**
 * Editable message content wrapper.
 */
interface MessageEditableContentProps {
  contentRef: React.RefObject<HTMLDivElement | null>;
  isEditable?: boolean;
  onBlur: (e: React.FocusEvent<HTMLDivElement>) => void;
  onClick: (e: React.MouseEvent) => void;
  style: React.CSSProperties;
}

const MessageEditableContent: React.FC<MessageEditableContentProps> = ({
  contentRef,
  isEditable,
  onBlur,
  onClick,
  style,
}) => (
  <div
    ref={contentRef}
    style={style}
    contentEditable={isEditable}
    onBlur={onBlur}
    onClick={onClick}
    suppressContentEditableWarning={true}
  />
);

/**
 * Card mode body renderer supporting both header-bar layout (Modern) and floating author layout (Smart).
 */
interface CardMessageBodyProps {
  themeConfig: ThemeConfig;
  color: ColorPalette;
  isUser: boolean;
  name: string;
  baseSize: string;
  contentRef: React.RefObject<HTMLDivElement | null>;
  isEditable?: boolean;
  handleBlur: (e: React.FocusEvent<HTMLDivElement>) => void;
  handleContentClick: (e: React.MouseEvent) => void;
  timestamp?: string | null;
}

const CardMessageBody: React.FC<CardMessageBodyProps> = ({
  themeConfig,
  color,
  isUser,
  name,
  baseSize,
  contentRef,
  isEditable,
  handleBlur,
  handleContentClick,
  timestamp,
}) => {
  const cardBgColor = isUser ? color.cardBgUser : color.cardBg;
  const borderRadius =
    isUser && themeConfig.cardBorderRadiusUser != null
      ? themeConfig.cardBorderRadiusUser
      : themeConfig.cardBorderRadius || '10px';

  const cardStyle: React.CSSProperties = {
    flex: 1,
    minWidth: 0,
    borderRadius,
    background: cardBgColor,
    boxShadow: themeConfig.cardShadow || color.shadow,
    border: themeConfig.cardBorder !== false ? `1px solid ${color.border}` : 'none',
    overflow: 'hidden',
    ...(themeConfig.cardBackdropFilter && {
      backdropFilter: 'blur(8px)',
      WebkitBackdropFilter: 'blur(8px)',
    }),
  };

  const contentStyle: React.CSSProperties = {
    padding: `${themeConfig.cardPaddingY || 12}px ${themeConfig.cardPaddingX || 14}px`,
    color: color.text,
    lineHeight: themeConfig.lineHeight,
    wordWrap: 'break-word',
    fontSize: baseSize,
  };

  // ModernMessage layout: Author name in a distinct card header bar
  if (themeConfig.nameInHeader) {
    const nameBarStyle: React.CSSProperties = {
      color: themeConfig.nameColorOverride
        ? `${color.nameColor} !important`
        : color.nameColor,
      fontWeight: 600,
      fontSize: `calc(${baseSize} * ${themeConfig.nameFontSize})`,
      padding: `${themeConfig.nameBarPaddingY || 8}px ${themeConfig.nameBarPaddingX || 14}px`,
      borderBottom: `1px solid ${color.border}`,
      textAlign: isUser ? 'right' : 'left',
      opacity: themeConfig.nameOpacity,
      display: 'flex',
      alignItems: 'center',
      justifyContent: isUser ? 'flex-end' : 'space-between',
    };

    return (
      <div style={cardStyle}>
        {themeConfig.showName && (
          <div style={nameBarStyle}>
            <span>{name}</span>
            {themeConfig.showTime && timestamp && (
              <span
                style={{
                  fontSize: `calc(${baseSize} * ${themeConfig.timeFontSize || 0.75})`,
                  opacity: themeConfig.timeOpacity || 0.6,
                  fontWeight: 400,
                  marginLeft: '8px',
                }}
              >
                {timestamp}
              </span>
            )}
          </div>
        )}
        <MessageEditableContent
          contentRef={contentRef}
          isEditable={isEditable}
          onBlur={handleBlur}
          onClick={handleContentClick}
          style={contentStyle}
        />
      </div>
    );
  }

  // SmartMessage layout: Author name floating above the card container
  const nameAboveStyle: React.CSSProperties = {
    color: themeConfig.nameColorOverride
      ? `${color.nameColor} !important`
      : color.nameColor,
    fontWeight: 600,
    fontSize: `calc(${baseSize} * ${themeConfig.nameFontSize})`,
    marginBottom: '4px',
    marginLeft: '6px',
    opacity: themeConfig.nameOpacity,
  };

  const showAuthorName =
    themeConfig.showName && themeConfig.nameShowForUser !== false && !isUser;

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: isUser ? 'flex-end' : 'flex-start',
        maxWidth: '85%',
        minWidth: 0,
      }}
    >
      {showAuthorName && <span style={nameAboveStyle}>{name}</span>}
      <div style={cardStyle}>
        <MessageEditableContent
          contentRef={contentRef}
          isEditable={isEditable}
          onBlur={handleBlur}
          onClick={handleContentClick}
          style={contentStyle}
        />
      </div>
      {themeConfig.showTime && timestamp && (
        <span
          style={{
            fontSize: `calc(${baseSize} * ${themeConfig.timeFontSize || 0.75})`,
            opacity: themeConfig.timeOpacity || 0.6,
            marginTop: '2px',
            marginRight: isUser ? '4px' : undefined,
            marginLeft: !isUser ? '4px' : undefined,
          }}
        >
          {timestamp}
        </span>
      )}
    </div>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// Utility Helpers
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Computes root container flex styles based on theme configuration and participant role.
 */
function getContainerStyle(
  themeConfig: ThemeConfig,
  isUser: boolean
): React.CSSProperties {
  const style: React.CSSProperties = {
    position: 'relative',
    display: 'flex',
    alignItems: 'flex-start',
    marginBottom: `${themeConfig.marginBottom}px`,
    flexDirection: isUser ? 'row-reverse' : themeConfig.flexDirection,
  };

  if (themeConfig.gap != null) {
    style.gap = `${themeConfig.gap}px`;
  }
  if (themeConfig.containerPaddingX != null) {
    style.padding = `0 ${themeConfig.containerPaddingX}px`;
  }

  return style;
}

/**
 * Safely extracts timestamp text if present within the source message node.
 */
function extractTimestampFromNode(node: Element): string | null {
  try {
    const timeEl = node.querySelector('.chat-time, time, [data-time], [data-timestamp]');
    if (timeEl?.textContent?.trim()) {
      return timeEl.textContent.trim();
    }
    const attrTime = node.getAttribute('data-timestamp') || node.getAttribute('data-time');
    if (attrTime?.trim()) {
      return attrTime.trim();
    }
  } catch {
    // Ignore DOM query issues
  }
  return null;
}

// ─────────────────────────────────────────────────────────────────────────────
// Main Component
// ─────────────────────────────────────────────────────────────────────────────

/**
 * BaseMessage component.
 * Serves as the shared template engine for customizable chat themes.
 */
const BaseMessage: React.FC<BaseMessageProps> = (props) => {
  const {
    themeConfig,
    charInfoName,
    isForArca,
    showAvatar,
    isForExport,
    isEditable,
    index,
    color,
    showBubble,
  } = props;

  const mc = useMessageCard(props);
  const { avatarSrc, isUser, baseSize, contentRef, handleBlur, handleContentClick, name } = mc;

  const timestamp = themeConfig.showTime ? extractTimestampFromNode(props.node) : null;
  const containerStyle = getContainerStyle(themeConfig, isUser);
  const isCardMode = themeConfig.renderMode === 'card';

  return (
    <div style={containerStyle}>
      {/* Delete button positioned before the avatar */}
      {isEditable && themeConfig.deleteButtonPlacement === 'beforeAvatar' && (
        <DeleteButton
          index={index}
          isUser={isUser}
          placement="beforeAvatar"
          customStyle={themeConfig.deleteButtonStyle}
        />
      )}

      {/* Avatar Section */}
      <MessageAvatarSection
        avatarSrc={avatarSrc}
        charInfoName={charInfoName}
        isUser={isUser}
        isForArca={isForArca}
        showAvatar={showAvatar}
        isForExport={isForExport}
        isEditable={isEditable}
        index={index}
        themeConfig={themeConfig}
        colorShadow={color.shadow}
      />

      {/* Message Content: Card mode vs Bubble mode */}
      {isCardMode ? (
        <CardMessageBody
          themeConfig={themeConfig}
          color={color}
          isUser={isUser}
          name={name}
          baseSize={baseSize}
          contentRef={contentRef}
          isEditable={isEditable}
          handleBlur={handleBlur}
          handleContentClick={handleContentClick}
          timestamp={timestamp}
        />
      ) : (
        <MessageCard
          themeConfig={themeConfig}
          color={color}
          showBubble={showBubble}
          isEditable={isEditable}
          baseSize={baseSize}
          messageHtml={mc.messageHtml}
          contentRef={contentRef}
          isUser={isUser}
          name={name}
          handleBlur={handleBlur}
          handleContentClick={handleContentClick}
        />
      )}

      {/* Delete button positioned after content */}
      {isEditable && themeConfig.deleteButtonPlacement === 'afterContent' && (
        <DeleteButton
          index={index}
          isUser={isUser}
          placement="afterContent"
          customStyle={themeConfig.deleteButtonStyle}
        />
      )}
    </div>
  );
};

export default BaseMessage;
