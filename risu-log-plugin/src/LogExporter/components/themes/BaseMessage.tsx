import React from 'react';
import type { MessageProps } from '../../../types';
import Avatar from '../Avatar';
import { useMessageCard } from './useMessageCard';
import MessageCard from './MessageCard';

// Theme configuration interface
export interface ThemeConfig {
  // Layout
  marginBottom: number;
  flexDirection: 'row' | 'row-reverse';
  gap?: number;
  containerPaddingX?: number;

  // Avatar
  avatarSize: number;
  avatarRadius: string | number;
  avatarBorder?: boolean;
  avatarMargin: number;

  // Name
  showName: boolean;
  nameFontSize: number;
  nameMarginTop?: number;
  nameMarginBottom: number;
  nameOpacity: number;
  nameColorOverride?: boolean;
  nameShowForUser?: boolean; // When false, name only shown for non-user (SmartMessage)

  // Render mode: 'bubble' | 'card'
  renderMode?: 'bubble' | 'card';

  // Bubble (when renderMode === 'bubble')
  bubbleRadius?: string;
  bubbleRadiusUser?: string;
  bubblePaddingX?: number;
  bubblePaddingY?: number;

  // Non-bubble (when renderMode === 'bubble' and !showBubble)
  nobubblePaddingX?: number;
  nobubblePaddingY?: number;

  // Card (when renderMode === 'card')
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

  // Shared
  lineHeight: number;

  // Delete button placement: 'beforeAvatar' | 'inAvatar' | 'afterContent'
  deleteButtonPlacement: 'beforeAvatar' | 'inAvatar' | 'afterContent';
  deleteButtonStyle?: React.CSSProperties;
  deleteButtonOpposite?: boolean; // When true, button position flips based on isUser (SmartMessage)
}

interface BaseMessageProps extends MessageProps {
  themeConfig: ThemeConfig;
}

/**
 * 메시지 삭제 버튼 컴포넌트.
 * placement에 따라 스타일이 달라집니다.
 */
interface DeleteButtonProps {
  index: number;
  isUser: boolean;
  placement: 'beforeAvatar' | 'inAvatar' | 'afterContent';
  customStyle?: React.CSSProperties;
  opposite?: boolean;
}

const DeleteButton: React.FC<DeleteButtonProps> = ({ index, isUser, placement, customStyle, opposite }) => {
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
    backgroundColor: 'rgba(200,50,50,0.7)',
    color: '#fff',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 10,
  };

  const inAvatarStyle: React.CSSProperties = opposite
    ? { ...baseStyle, right: isUser ? 'auto' : '-5px', left: isUser ? '-5px' : 'auto' }
    : baseStyle;

  const afterContentStyle: React.CSSProperties = {
    float: isUser ? 'left' : 'right',
    opacity: 0.3,
  };

  const style = placement === 'inAvatar'
    ? { ...inAvatarStyle, ...customStyle }
    : placement === 'afterContent'
      ? { ...afterContentStyle, ...customStyle }
      : customStyle;

  return (
    <button
      className="log-exporter-delete-msg-btn"
      data-message-index={index}
      title="메시지 삭제"
      style={style}
    >&times;</button>
  );
};

const BaseMessage: React.FC<BaseMessageProps> = (props) => {
  const {
    themeConfig, charInfoName,
    isForArca, showAvatar, isForExport, isEditable, index,
  } = props;

  const mc = useMessageCard(props);
  const { avatarSrc, isUser } = mc;

  const cardBgColor = isUser ? props.color.cardBgUser : props.color.cardBg;

  // Container styles
  const containerStyle: React.CSSProperties = {
    position: 'relative',
    display: 'flex',
    alignItems: 'flex-start',
    marginBottom: `${themeConfig.marginBottom}px`,
    flexDirection: isUser ? 'row-reverse' : themeConfig.flexDirection,
  };
  if (themeConfig.gap != null) {
    containerStyle.gap = `${themeConfig.gap}px`;
  }
  if (themeConfig.containerPaddingX != null) {
    containerStyle.padding = `0 ${themeConfig.containerPaddingX}px`;
  }

  // Avatar styles
  const avatarBaseStyle: React.CSSProperties = {
    width: themeConfig.avatarSize,
    height: themeConfig.avatarSize,
    minWidth: themeConfig.avatarSize,
    borderRadius: themeConfig.avatarRadius,
    boxShadow: props.color.shadow || 'none',
  };

  const avatarMarginStyle: React.CSSProperties = {
    margin: isUser
      ? `0 0 0 ${themeConfig.avatarMargin}px`
      : `0 ${themeConfig.avatarMargin}px 0 0`,
  };

  // --- Card render mode (ModernMessage, SmartMessage) ---
  if (themeConfig.renderMode === 'card') {
    // Card body styles
    const cardStyle: React.CSSProperties = {
      flex: 1,
      minWidth: 0,
      borderRadius: themeConfig.cardBorderRadius || '10px',
      background: cardBgColor,
      boxShadow: themeConfig.cardShadow || props.color.shadow,
      border: themeConfig.cardBorder !== false ? `1px solid ${props.color.border}` : 'none',
      overflow: 'hidden',
    };
    if (themeConfig.cardBackdropFilter) {
      cardStyle.backdropFilter = 'blur(8px)';
      (cardStyle as React.CSSProperties & { WebkitBackdropFilter?: string }).WebkitBackdropFilter = 'blur(8px)';
    }
    if (themeConfig.cardBorderRadiusUser != null) {
      cardStyle.borderRadius = isUser ? themeConfig.cardBorderRadiusUser : themeConfig.cardBorderRadius || '10px';
    }

    // Content styles
    const contentStyle: React.CSSProperties = {
      padding: `${themeConfig.cardPaddingY || 12}px ${themeConfig.cardPaddingX || 14}px`,
      color: props.color.text,
      lineHeight: themeConfig.lineHeight,
      wordWrap: 'break-word',
      fontSize: mc.baseSize,
    };

    // Name bar styles (for ModernMessage)
    const nameBarStyle: React.CSSProperties = {
      color: themeConfig.nameColorOverride
        ? `${props.color.nameColor} !important`
        : props.color.nameColor,
      fontWeight: 600,
      fontSize: `calc(${mc.baseSize} * ${themeConfig.nameFontSize})`,
      padding: `${themeConfig.nameBarPaddingY || 8}px ${themeConfig.nameBarPaddingX || 14}px`,
      borderBottom: `1px solid ${props.color.border}`,
      textAlign: isUser ? 'right' : 'left',
      opacity: themeConfig.nameOpacity,
    };

    // Name above card styles (for SmartMessage)
    const nameAboveStyle: React.CSSProperties = {
      color: themeConfig.nameColorOverride
        ? `${props.color.nameColor} !important`
        : props.color.nameColor,
      fontWeight: 600,
      fontSize: `calc(${mc.baseSize} * ${themeConfig.nameFontSize})`,
      marginBottom: '4px',
      marginLeft: '6px',
      opacity: themeConfig.nameOpacity,
    };

    return (
      <div style={containerStyle}>
        {/* Delete button before Avatar */}
        {isEditable && themeConfig.deleteButtonPlacement === 'beforeAvatar' && (
          <DeleteButton index={index} isUser={isUser} placement="beforeAvatar" customStyle={themeConfig.deleteButtonStyle} />
        )}

        {/* Avatar section */}
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

        {/* Card body */}
        {themeConfig.nameInHeader ? (
          // ModernMessage: name in header bar inside card
          <div style={cardStyle}>
            {themeConfig.showName && (
              <div style={nameBarStyle}>{mc.name}</div>
            )}
            <div ref={mc.contentRef} style={contentStyle}
              contentEditable={isEditable}
              onBlur={mc.handleBlur}
              onClick={mc.handleContentClick}
              suppressContentEditableWarning={true}
            />
          </div>
        ) : (
          // SmartMessage: name above card
          <div style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: isUser ? 'flex-end' : 'flex-start',
            maxWidth: '85%',
            minWidth: 0,
          }}>
            {themeConfig.showName && themeConfig.nameShowForUser !== false && !isUser && (
              <span style={nameAboveStyle}>{mc.name}</span>
            )}
            <div style={cardStyle}>
              <div ref={mc.contentRef} style={contentStyle}
                contentEditable={isEditable}
                onBlur={mc.handleBlur}
                onClick={mc.handleContentClick}
                suppressContentEditableWarning={true}
              />
            </div>
          </div>
        )}
      </div>
    );
  }

  // --- Default bubble render mode ---
  return (
    <div style={containerStyle}>
      {/* Delete button before Avatar (BasicMessage, CustomMessage) */}
      {isEditable && themeConfig.deleteButtonPlacement === 'beforeAvatar' && (
        <DeleteButton index={index} isUser={isUser} placement="beforeAvatar" customStyle={themeConfig.deleteButtonStyle} />
      )}

      {/* Avatar section */}
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
        {/* Delete button inside avatar wrapper (SmartMessage) */}
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

      {/* Message card */}
      <MessageCard
        themeConfig={themeConfig}
        color={props.color}
        showBubble={props.showBubble}
        isEditable={props.isEditable}
        baseSize={mc.baseSize}
        messageHtml={mc.messageHtml}
        contentRef={mc.contentRef}
        isUser={mc.isUser}
        name={mc.name}
        handleBlur={mc.handleBlur}
        handleContentClick={mc.handleContentClick}
      />

      {/* Delete button after content, floated (SimpleMessage) */}
      {isEditable && themeConfig.deleteButtonPlacement === 'afterContent' && (
        <DeleteButton index={index} isUser={isUser} placement="afterContent" customStyle={themeConfig.deleteButtonStyle} />
      )}
    </div>
  );
};

export default BaseMessage;
