import React from 'react';
import type { MessageProps } from '../../../types';
import { useMessageCard } from './useMessageCard';
import Avatar from '../Avatar';

const LogMessage: React.FC<MessageProps> = (props) => {
  const mc = useMessageCard(props);
  const { isUser, name, avatarSrc } = mc;


  return (
    <div className="chat-message-container log-theme-row" style={{
      position: 'relative', 
      display: 'flex', 
      flexDirection: 'column', 
      gap: '8px',
      padding: '12px 16px', 
      background: 'transparent',
      borderBottom: `1px solid ${props.color.border}22`,
      fontFamily: '"Fira Code", "JetBrains Mono", "SF Mono", Monaco, Consolas, monospace',
      fontSize: `calc(${mc.baseSize} * 0.95)`, 
      transition: 'all 0.15s ease-in-out',
    }}>
      <style>{`
        .log-theme-row:hover {
          background-color: ${props.color.border}15 !important;
        }
        .log-theme-row:hover .log-line-num {
          color: ${props.color.nameColor} !important;
          opacity: 1 !important;
        }
      `}</style>

      {/* 상단 메타 정보 행 (줄번호 + 방향배지 + 아바타 + 이름) */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', width: '100%' }}>


        {/* 3. 미니 아바타 (설정이 켜져 있을 때만) */}
        {props.showAvatar && (
          <div style={{ flexShrink: 0, display: 'flex', alignItems: 'center' }}>
            <Avatar
              avatarSrc={avatarSrc}
              name={props.charInfoName}
              isUser={isUser}
              isForArca={props.isForArca}
              showAvatar={props.showAvatar}
              baseStyle={{
                width: '20px',
                height: '20px',
                minWidth: '20px',
                borderRadius: props.avatarShape === 'square' ? '2px' : props.avatarShape === 'rounded' ? '4px' : props.avatarShape === 'squircle' ? '6px' : '50%',
                border: `1px solid ${props.color.nameColor}88`,
                boxShadow: 'none',
                objectPosition: 'top',
              }}
              marginStyle={{ margin: 0 }}
              isForExport={props.isForExport}
            />
          </div>
        )}

        {/* 4. 라벨 이름 영역 */}
        <div style={{ 
          color: props.color.nameColor, 
          fontWeight: 600, 
          fontSize: `calc(${mc.baseSize} * 0.9)`,
          flexShrink: 0, 
          textTransform: 'uppercase',
          letterSpacing: '0.5px',
          backgroundColor: `${props.color.nameColor}10`,
          padding: '2px 8px',
          borderRadius: '4px',
          border: `1px solid ${props.color.nameColor}25`,
          maxWidth: '150px',
          textOverflow: 'ellipsis',
          overflow: 'hidden',
          whiteSpace: 'nowrap',
          display: 'flex',
          alignItems: 'center',
          height: '16px',
        }}>
          {name}
        </div>

        {/* 우측 끝으로 삭제 버튼 배치 */}
        {props.isEditable && (
          <button 
            className="log-exporter-delete-msg-btn" 
            data-message-index={props.index} 
            title="메시지 삭제"
            style={{
              marginLeft: 'auto',
              background: 'none',
              border: 'none',
              color: 'rgba(200,50,50,0.6)',
              cursor: 'pointer',
              fontSize: '14px',
              padding: '2px 6px',
              opacity: 0.3,
              transition: 'opacity 0.2s',
            }}
            onMouseEnter={(e) => e.currentTarget.style.opacity = '1'}
            onMouseLeave={(e) => e.currentTarget.style.opacity = '0.3'}
          >&times;</button>
        )}
      </div>

      {/* 하단 본문 행 (가로 100%를 온전히 다 채움) */}
      <div ref={mc.contentRef} style={{ 
        color: props.color.text, 
        width: '100%',
        lineHeight: 1.6, 
        wordWrap: 'break-word', 
        fontSize: mc.baseSize,
        paddingLeft: '4px',
        boxSizing: 'border-box',
      }} 
      contentEditable={props.isEditable} 
      onBlur={mc.handleBlur} 
      onClick={mc.handleContentClick} 
      suppressContentEditableWarning={true} 
      />
    </div>
  );
};

export default LogMessage;
