import React, { memo } from 'react';
import type { ColorPalette } from '../../../types';
import type { ThemeConfig } from './BaseMessage';

/**
 * Props for the MessageCard component.
 */
export interface MessageCardProps {
  /** Theme-specific layout, typography, and styling parameters. */
  themeConfig: ThemeConfig;
  /** Active color palette for backgrounds, borders, shadows, and text. */
  color: ColorPalette;
  /** Whether to render the message in a speech bubble container. */
  showBubble: boolean;
  /** Whether message text is directly editable by the user. */
  isEditable?: boolean;
  /** Pre-computed base font size (e.g. '16px'). */
  baseSize: string;
  /** Processed HTML string of the message body. */
  messageHtml: string;
  /** Ref to the content-editable div element for DOM synchronization. */
  contentRef: React.RefObject<HTMLDivElement | null>;
  /** Indicates whether this message was sent by the user. */
  isUser: boolean;
  /** Sender name to display when `themeConfig.showName` is enabled. */
  name: string;
  /** Handler invoked when content editable loses focus. */
  handleBlur: (e: React.FocusEvent<HTMLDivElement>) => void;
  /** Handler invoked when message content is clicked. */
  handleContentClick: (e: React.MouseEvent) => void;
}

/** Static container style shared across renders. */
const CONTAINER_STYLE: React.CSSProperties = {
  flex: 1,
  minWidth: 0,
};

/**
 * Computes CSS styles for the sender name label based on theme config and user alignment.
 */
function createNameStyle(
  themeConfig: ThemeConfig,
  color: ColorPalette,
  baseSize: string,
  isUser: boolean
): React.CSSProperties {
  const nameColor = themeConfig.nameColorOverride
    ? `${color.nameColor} !important`
    : color.nameColor;

  const style: React.CSSProperties = {
    color: nameColor,
    fontWeight: 600,
    fontSize: `calc(${baseSize} * ${themeConfig.nameFontSize})`,
    display: 'block',
    marginBottom: `${themeConfig.nameMarginBottom}px`,
    textAlign: isUser ? 'right' : 'left',
    opacity: themeConfig.nameOpacity,
  };

  if (themeConfig.nameMarginTop != null) {
    style.marginTop = `${themeConfig.nameMarginTop}px`;
  }

  return style;
}

/**
 * Computes CSS styles for the message content body (bubble vs. plain text).
 */
function createContentStyle(
  themeConfig: ThemeConfig,
  color: ColorPalette,
  baseSize: string,
  isUser: boolean,
  showBubble: boolean
): React.CSSProperties {
  if (showBubble) {
    const cardBgColor = isUser ? color.cardBgUser : color.cardBg;
    const borderRadius =
      isUser && themeConfig.bubbleRadiusUser != null
        ? themeConfig.bubbleRadiusUser
        : themeConfig.bubbleRadius;

    return {
      backgroundColor: cardBgColor,
      borderRadius,
      padding: `${themeConfig.bubblePaddingY}px ${themeConfig.bubblePaddingX}px`,
      boxShadow: color.shadow,
      border: `1px solid ${color.border}`,
      color: color.text,
      lineHeight: themeConfig.lineHeight,
      wordWrap: 'break-word',
      position: 'relative',
      fontSize: baseSize,
    };
  }

  return {
    color: color.text,
    lineHeight: themeConfig.lineHeight,
    wordWrap: 'break-word',
    padding: `${themeConfig.nobubblePaddingY}px ${themeConfig.nobubblePaddingX}px`,
    fontSize: baseSize,
  };
}

/**
 * Renders the message body card/bubble with optional sender name header.
 * Used by bubble-based themes (BasicMessage, CustomMessage) in BaseMessage.
 */
const MessageCard: React.FC<MessageCardProps> = ({
  themeConfig,
  color,
  showBubble,
  isEditable,
  baseSize,
  messageHtml,
  contentRef,
  isUser,
  name,
  handleBlur,
  handleContentClick,
}) => {
  // Do not render empty messages
  if (!messageHtml || messageHtml.trim().length === 0) {
    return null;
  }

  const nameStyle = themeConfig.showName
    ? createNameStyle(themeConfig, color, baseSize, isUser)
    : undefined;

  const contentStyle = createContentStyle(
    themeConfig,
    color,
    baseSize,
    isUser,
    showBubble
  );

  return (
    <div style={CONTAINER_STYLE}>
      {nameStyle && <strong style={nameStyle}>{name}</strong>}
      <div
        ref={contentRef}
        style={contentStyle}
        contentEditable={isEditable}
        onBlur={handleBlur}
        onClick={handleContentClick}
        suppressContentEditableWarning={true}
      />
    </div>
  );
};

export default memo(MessageCard);
