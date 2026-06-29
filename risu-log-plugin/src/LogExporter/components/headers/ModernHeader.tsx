import React from 'react';
import type { LogHeaderProps } from '../../../types';
import { useParsedTags } from '../../hooks/useHeaderHelpers';
import HeaderTags from './HeaderTags';

const ModernHeader: React.FC<LogHeaderProps> = ({ charInfo, color, headerTags }) => {
  const tags = useParsedTags(headerTags);

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
           objectPosition: 'top',
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
          <HeaderTags tags={tags} color={color} variant="modern" />
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
