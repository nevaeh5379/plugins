import React, { useRef, useEffect } from 'react';
import type { MessageProps } from '../../../types';
import Avatar from '../Avatar';
import { useMessageProcessor } from '../../hooks/useMessageProcessor';
import { getNameFromNode } from '../../utils/domUtils';

const SmartMessage: React.FC<MessageProps> = (props) => {
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
    width: '40px', height: '40px', minWidth: '40px',
    borderRadius: '50%',
    border: 'none',
    boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
  };
  const avatarMarginStyle: React.CSSProperties = {
    margin: isUser ? '0 0 0 10px' : '0 10px 0 0',
  };

  const cardBg = isUser ? color.cardBgUser : color.cardBg;
  const borderRadius = isUser ? '16px 4px 16px 16px' : '4px 16px 16px 16px';

  return (
    <div className="chat-message-container" style={{
      display: 'flex', alignItems: 'flex-start',
      marginBottom: '20px', gap: '4px',
      flexDirection: isUser ? 'row-reverse' : 'row',
      padding: '0 4px',
    }}>
      <div style={{ position: 'relative', flexShrink: 0 }}>
        <Avatar avatarSrc={avatarSrc} name={name} isUser={isUser} isForArca={isForArca} showAvatar={showAvatar} baseStyle={avatarBaseStyle} marginStyle={avatarMarginStyle} isForExport={isForExport} />
        {isEditable && <button className="log-exporter-delete-msg-btn" data-message-index={index} title="메시지 삭제" style={{ width: '18px', height: '18px', fontSize: '12px', top: '-5px', right: isUser ? 'auto' : '-5px', left: isUser ? '-5px' : 'auto' }}>&times;</button>}
      </div>

      <div style={{
        display: 'flex', flexDirection: 'column',
        alignItems: isUser ? 'flex-end' : 'flex-start',
        maxWidth: '85%', minWidth: 0,
      }}>
        {!isUser && (
          <span style={{
            color: color.nameColor, fontWeight: 600,
            fontSize: `calc(${baseSize} * 0.88)`,
            marginBottom: '4px', marginLeft: '6px',
            opacity: 0.85,
          }}>
            {name}
          </span>
        )}

        <div style={{
          borderRadius,
          background: cardBg,
          boxShadow: '0 2px 12px rgba(0,0,0,0.06)',
          overflow: 'hidden',
          backdropFilter: 'blur(8px)',
          WebkitBackdropFilter: 'blur(8px)',
          border: `1px solid ${color.border}`,
        }}>
          <div ref={contentRef} style={{
            padding: '10px 14px',
            color: color.text,
            lineHeight: 1.7,
            wordWrap: 'break-word',
            fontSize: baseSize,
          }} contentEditable={isEditable} onBlur={handleBlur} onClick={handleContentClick} suppressContentEditableWarning={true} />
        </div>
      </div>
    </div>
  );
};

export default SmartMessage;