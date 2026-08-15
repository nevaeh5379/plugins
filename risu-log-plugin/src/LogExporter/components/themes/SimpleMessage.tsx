import React from 'react';
import type { MessageProps } from '../../../types';
import { useMessageCard } from './useMessageCard';

/**
 * SimpleMessage
 *
 * A minimalist message theme that renders messages without chat bubbles or avatars.
 * Distinguishes user messages using left-border styling and asymmetric horizontal padding.
 */
const SimpleMessage: React.FC<MessageProps> = (props) => {
  const { color, isEditable, index } = props;
  const {
    baseSize,
    messageHtml,
    contentRef,
    isUser,
    name,
    handleBlur,
    handleContentClick,
  } = useMessageCard(props);

  // Do not render empty messages
  if (!messageHtml || messageHtml.trim().length === 0) {
    return null;
  }

  const containerStyle: React.CSSProperties = {
    marginBottom: '1.4em',
    paddingLeft: isUser ? '1.5em' : '0',
    paddingRight: isUser ? '0' : '1.5em',
    borderLeft: isUser ? `2px solid ${color.border}` : 'none',
  };

  const nameStyle: React.CSSProperties = {
    color: color.nameColor,
    fontWeight: 600,
    fontSize: `calc(${baseSize} * 0.88)`,
    marginBottom: '0.2em',
    opacity: 0.7,
  };

  const contentStyle: React.CSSProperties = {
    color: color.text,
    lineHeight: 1.7,
    fontSize: baseSize,
  };

  const deleteButtonStyle: React.CSSProperties = {
    float: isUser ? 'left' : 'right',
    opacity: 0.3,
  };

  return (
    <div className="chat-message-container" style={containerStyle}>
      <div style={nameStyle}>{name}</div>
      <div
        ref={contentRef}
        style={contentStyle}
        contentEditable={isEditable}
        onBlur={handleBlur}
        onClick={handleContentClick}
        suppressContentEditableWarning
      />
      {isEditable && (
        <button
          type="button"
          className="log-exporter-delete-msg-btn"
          data-message-index={index}
          title="메시지 삭제"
          style={deleteButtonStyle}
        >
          &times;
        </button>
      )}
    </div>
  );
};

export default SimpleMessage;
