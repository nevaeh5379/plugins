import React from 'react';
import type { MessageProps } from '../../../types';
import { useMessageCard } from './useMessageCard';

const LogMessage: React.FC<MessageProps> = (props) => {
  const mc = useMessageCard(props);
  const { isUser, name } = mc;

  const lineNumber = String(props.index + 1).padStart(4, '0');
  const logBg = isUser ? props.color.cardBgUser : props.color.cardBg;
  const statusIcon = isUser ? '→' : '←';

  return (
    <div className="chat-message-container" style={{
      position: 'relative', display: 'flex', alignItems: 'flex-start', gap: '8px',
      padding: '8px 12px', background: logBg, border: `1px solid ${props.color.border}`,
      marginBottom: '2px', fontFamily: 'Courier New, SF Mono, Monaco, Inconsolata, Fira Code, monospace',
      fontSize: mc.baseSize, transition: 'all 0.2s ease'
    }}>
      <div style={{ color: props.color.textSecondary, fontSize: `calc(${mc.baseSize} * 0.88)`, width: '35px', flexShrink: 0, textAlign: 'right', paddingRight: '8px', borderRight: `1px solid ${props.color.border}`, opacity: 0.6 }}>
        {lineNumber}
      </div>
      <div style={{ color: props.color.nameColor, fontSize: `calc(${mc.baseSize} * 0.94)`, width: '15px', flexShrink: 0, textAlign: 'center', fontWeight: 'bold' }}>
        {statusIcon}
      </div>
      <div style={{ color: props.color.nameColor, fontWeight: 'bold', width: '80px', flexShrink: 0, textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap', fontSize: `calc(${mc.baseSize} * 0.94)` }}>
        [{name.toUpperCase()}]
      </div>
      <div ref={mc.contentRef} style={{ color: props.color.text, flex: 1, lineHeight: 1.4, wordWrap: 'break-word', fontSize: mc.baseSize }} contentEditable={props.isEditable} onBlur={mc.handleBlur} onClick={mc.handleContentClick} suppressContentEditableWarning={true} />
      {props.isEditable && <button className="log-exporter-delete-msg-btn" data-message-index={props.index} title="메시지 삭제">&times;</button>}
    </div>
  );
};

export default LogMessage;
