import React from 'react';
import type { MessageProps } from '../../../types';
import { useMessageCard } from './useMessageCard';

const SimpleMessage: React.FC<MessageProps> = (props) => {
  const mc = useMessageCard(props);
  const { messageHtml, isUser } = mc;

  if (!messageHtml || messageHtml.trim().length === 0) return null;

  return (
    <div className="chat-message-container" style={{
      marginBottom: '1.4em',
      paddingLeft: isUser ? '1.5em' : '0',
      paddingRight: isUser ? '0' : '1.5em',
      borderLeft: isUser ? `2px solid ${props.color.border}` : 'none',
    }}>
      <div style={{
        color: props.color.nameColor,
        fontWeight: 600,
        fontSize: `calc(${mc.baseSize} * 0.88)`,
        marginBottom: '0.2em',
        opacity: 0.7,
      }}>
        {mc.name}
      </div>
      <div ref={mc.contentRef} style={{
        color: props.color.text,
        lineHeight: 1.7,
        fontSize: mc.baseSize,
      }}
        contentEditable={props.isEditable}
        onBlur={mc.handleBlur}
        onClick={mc.handleContentClick}
        suppressContentEditableWarning={true}
      />
      {props.isEditable && (
        <button
          className="log-exporter-delete-msg-btn"
          data-message-index={props.index}
          style={{ float: isUser ? 'left' : 'right', opacity: 0.3 }}
        >&times;</button>
      )}
    </div>
  );
};

export default SimpleMessage;
