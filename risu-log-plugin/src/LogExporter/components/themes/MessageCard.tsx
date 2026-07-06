import React from 'react';
import type { ColorPalette } from '../../../types';
import type { ThemeConfig } from './BaseMessage';

interface MessageCardProps {
  themeConfig: ThemeConfig;
  color: ColorPalette;
  showBubble: boolean;
  isEditable?: boolean;
  // Pre-computed values from useMessageCard
  baseSize: string;
  messageHtml: string;
  contentRef: React.RefObject<HTMLDivElement | null>;
  isUser: boolean;
  name: string;
  handleBlur: (e: React.FocusEvent<HTMLDivElement>) => void;
  handleContentClick: (e: React.MouseEvent) => void;
}

const MessageCard: React.FC<MessageCardProps> = (props) => {
  const {
    themeConfig, color, showBubble, isEditable,
    baseSize, messageHtml, contentRef,
    isUser, name, handleBlur, handleContentClick,
  } = props;

  // Early return for empty content
  if (!messageHtml || messageHtml.trim().length === 0) return null;

  const cardBgColor = isUser ? color.cardBgUser : color.cardBg;

  // Name display
  if (themeConfig.showName) {
    const nameColor = themeConfig.nameColorOverride
      ? `${color.nameColor} !important`
      : color.nameColor;

    const nameStyle: React.CSSProperties = {
      color: nameColor,
      fontWeight: 600,
      fontSize: `calc(${baseSize} * ${themeConfig.nameFontSize})`,
      display: 'block',
      marginBottom: `${themeConfig.nameMarginBottom}px`,
      textAlign: isUser ? 'right' : 'left',
      opacity: themeConfig.nameOpacity,
    };

    if (themeConfig.nameMarginTop != null) {
      nameStyle.marginTop = `${themeConfig.nameMarginTop}px`;
    }

    return (
      <div style={{ flex: 1, minWidth: 0 }}>
        <strong style={nameStyle}>{name}</strong>
        {renderContent()}
      </div>
    );
  }

  // No name display
  return (
    <div style={{ flex: 1, minWidth: 0 }}>
      {renderContent()}
    </div>
  );

  function renderContent() {
    if (showBubble) {
      const bubbleStyle: React.CSSProperties = {
        backgroundColor: cardBgColor,
        borderRadius: themeConfig.bubbleRadius,
        padding: `${themeConfig.bubblePaddingY}px ${themeConfig.bubblePaddingX}px`,
        boxShadow: color.shadow,
        border: `1px solid ${color.border}`,
        color: color.text,
        lineHeight: themeConfig.lineHeight,
        wordWrap: 'break-word',
        position: 'relative',
        fontSize: baseSize,
      };

      // User-specific border radius (asymmetric bubbles)
      if (themeConfig.bubbleRadiusUser != null) {
        bubbleStyle.borderRadius = isUser ? themeConfig.bubbleRadiusUser : themeConfig.bubbleRadius;
      }

      return (
        <div ref={contentRef} style={bubbleStyle}
          contentEditable={isEditable}
          onBlur={handleBlur}
          onClick={handleContentClick}
          suppressContentEditableWarning={true}
        />
      );
    }

    return (
      <div ref={contentRef} style={{
        color: color.text,
        lineHeight: themeConfig.lineHeight,
        wordWrap: 'break-word',
        padding: `${themeConfig.nobubblePaddingY}px ${themeConfig.nobubblePaddingX}px`,
        fontSize: baseSize,
      }}
        contentEditable={isEditable}
        onBlur={handleBlur}
        onClick={handleContentClick}
        suppressContentEditableWarning={true}
      />
    );
  }
};

export default MessageCard;
