import React, { useRef, useEffect } from 'react';
import type { MessageProps } from '../../../types';
import Avatar from '../Avatar';
import { useMessageProcessor } from '../../hooks/useMessageProcessor';
import { getNameFromNode } from '../../utils/domUtils';

const ModernMessage: React.FC<MessageProps> = (props) => {
  const { node, index, charInfoName, color, showAvatar, isForArca, embedImagesAsBlob, allowHtmlRendering, globalSettings, isEditable, onMessageUpdate, imageScale, isForExport, replacementRules, fontSize } = props;
  const baseSize = fontSize ? `${fontSize}px` : '16px';
  const originalMessageEl = node.querySelector('.prose, .chattext');
  const messageHtml = useMessageProcessor(originalMessageEl, embedImagesAsBlob, allowHtmlRendering, color, imageScale, props.onRendered, replacementRules);
  const contentRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (contentRef.current && messageHtml !== contentRef.current.innerHTML) {
      contentRef.current.innerHTML = messageHtml;
    }
  }, [messageHtml]);

  if (!messageHtml || messageHtml.trim().length === 0) return null;

  const isUser = node.classList.contains('justify-end');
  const name = getNameFromNode(node as HTMLElement, globalSettings, charInfoName);
  const avatarSrc = props.avatarMap.get(name);

  const handleBlur = (e: React.FocusEvent<HTMLDivElement>) => {
    if (onMessageUpdate && e.currentTarget.innerHTML !== messageHtml) {
      onMessageUpdate(index, e.currentTarget.innerHTML);
    }
  };

  const handleContentClick = (e: React.MouseEvent) => {
    if (isEditable) e.stopPropagation();
  };

  const avatarBaseStyle: React.CSSProperties = {
    width: '44px', height: '44px', minWidth: '44px',
    borderRadius: '12px',
    boxShadow: color.shadow || 'none',
    border: `1px solid ${color.border}`,
  };
  const avatarMarginStyle: React.CSSProperties = {
    margin: isUser ? '0 0 0 14px' : '0 14px 0 0',
  };

  const cardBg = isUser ? color.cardBgUser : color.cardBg;

  return (
    <div className="chat-message-container" style={{
      display: 'flex', alignItems: 'flex-start',
      marginBottom: '16px', gap: '14px',
      flexDirection: isUser ? 'row-reverse' : 'row',
    }}>
      <div style={{ position: 'relative' }}>
        <Avatar avatarSrc={avatarSrc} name={name} isUser={isUser} isForArca={isForArca} showAvatar={showAvatar} baseStyle={avatarBaseStyle} marginStyle={avatarMarginStyle} isForExport={isForExport} />
        {isEditable && <button className="log-exporter-delete-msg-btn" data-message-index={index} title="메시지 삭제">&times;</button>}
      </div>
      <div style={{
        flex: 1, minWidth: 0,
        borderRadius: '10px',
        background: cardBg,
        boxShadow: color.shadow,
        border: `1px solid ${color.border}`,
        overflow: 'hidden',
      }}>
        <div style={{
          color: color.nameColor, fontWeight: 600,
          fontSize: `calc(${baseSize} * 0.88)`,
          padding: '8px 14px',
          borderBottom: `1px solid ${color.border}`,
          textAlign: isUser ? 'right' : 'left',
          opacity: 0.9,
        }}>
          {name}
        </div>
        <div ref={contentRef} style={{
          padding: '12px 14px',
          color: color.text,
          lineHeight: 1.75,
          wordWrap: 'break-word',
          fontSize: baseSize,
        }} contentEditable={isEditable} onBlur={handleBlur} onClick={handleContentClick} suppressContentEditableWarning={true} />
      </div>
    </div>
  );
};

export default ModernMessage;