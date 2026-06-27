import React from 'react';
import type { CharInfo, ColorPalette } from '../../../types';

interface LogHeaderProps {
  charInfo: CharInfo;
  color: ColorPalette;
  headerTags?: string;
}

const ModernHeader: React.FC<LogHeaderProps> = ({ charInfo, color, headerTags }) => {
  const tags = headerTags ? headerTags.split(',').map(t => t.trim()).filter(Boolean) : [];

  return (
    <header style={{
      display: 'flex', alignItems: 'center', gap: '20px',
      padding: '20px',
      marginBottom: '2em',
      backgroundColor: color.cardBg,
      borderRadius: '12px',
      border: `1px solid ${color.border}`,
      boxShadow: color.shadow,
    }}>
      <div style={{ position: 'relative', flexShrink: 0 }}>
        <img src={charInfo.avatarUrl} data-log-exporter-avatar="true" style={{
          width: '72px', height: '72px', borderRadius: '12px',
          objectFit: 'cover', display: 'block',
          border: `1px solid ${color.border}`,
        }} />
        <div style={{
          position: 'absolute', bottom: '-3px', right: '-3px',
          width: '14px', height: '14px', borderRadius: '50%',
          backgroundColor: '#22c55e',
          border: `3px solid ${color.cardBg}`,
        }} />
      </div>

      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{
          display: 'flex', alignItems: 'center',
          gap: '10px', marginBottom: '4px', flexWrap: 'wrap',
        }}>
          <h1 style={{
            margin: 0, fontSize: '1.5em',
            color: color.nameColor, fontWeight: 700,
            letterSpacing: '-0.02em',
          }}>{charInfo.name}</h1>
          {tags.length > 0 && (
            <div style={{ display: 'flex', gap: '5px' }}>
              {tags.map((tag, i) => (
                <span key={i} style={{
                  fontSize: '0.72em', color: color.textSecondary,
                  backgroundColor: 'rgba(0,0,0,0.2)',
                  padding: '2px 8px', borderRadius: '4px',
                  border: `1px solid ${color.border}`,
                }}>{tag}</span>
              ))}
            </div>
          )}
        </div>
        <p style={{
          margin: 0, color: color.text, opacity: 0.75,
          fontSize: '0.9em', lineHeight: 1.5,
        }}>{charInfo.chatName}</p>
      </div>
    </header>
  );
};

export default ModernHeader;