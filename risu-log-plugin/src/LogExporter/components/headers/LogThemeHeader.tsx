import React from 'react';
import type { LogHeaderProps } from '../../../types';

const LogThemeHeader: React.FC<LogHeaderProps> = ({ charInfo, color, headerTags }) => {
  const tags = headerTags ? headerTags.split(',').map(tag => tag.trim()).filter(Boolean) : [];
  const today = new Date().toLocaleDateString('ko-KR', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });

  return (
    <header style={{
      marginBottom: '24px',
      padding: '18px 24px',
      backgroundColor: `${color.border}10`,
      borderRadius: '8px',
      border: `1px solid ${color.border}22`,
      display: 'flex',
      alignItems: 'center',
      gap: '16px',
      fontFamily: 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
    }}>
      {/* 1. 헤더 아바타 */}
      <div style={{ flexShrink: 0 }}>
        <img 
          src={charInfo.avatarUrl} 
          alt={charInfo.name}
          style={{
            width: '56px',
            height: '56px',
            borderRadius: '50%',
            objectFit: 'cover',
            border: 'none',
            boxShadow: color.shadow || 'none',
            objectPosition: 'top',
          }} 
        />
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', flex: 1, minWidth: 0 }}>
        <h1 style={{ 
          margin: 0, 
          fontSize: '1.25em', 
          fontWeight: 700, 
          color: color.text, 
          whiteSpace: 'nowrap', 
          overflow: 'hidden', 
          textOverflow: 'ellipsis',
          lineHeight: 1.2
        }}>
          {charInfo.name}
        </h1>
        
        {/* 날짜 및 메타 정보 */}
        <div style={{ 
          display: 'flex', 
          flexWrap: 'wrap', 
          gap: '12px', 
          fontSize: '0.82em', 
          color: color.textSecondary,
          opacity: 0.8,
          marginTop: '2px'
        }}>
          <span><strong>Date:</strong> {today}</span>
          <span style={{ opacity: 0.3 }}>|</span>
          <span>{charInfo.chatName || `${charInfo.name}와의 대화`}</span>
          
          {tags.length > 0 && (
            <>
              <span style={{ opacity: 0.3 }}>|</span>
              <div style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
                <strong>Tags:</strong>
                {tags.map((tag, idx) => (
                  <span key={idx} style={{
                    backgroundColor: `${color.nameColor}15`,
                    color: color.nameColor,
                    padding: '1px 6px',
                    borderRadius: '4px',
                    fontSize: '0.9em',
                    fontWeight: 500,
                  }}>{tag}</span>
                ))}
              </div>
            </>
          )}
        </div>
      </div>
    </header>
  );
};

export default LogThemeHeader;
