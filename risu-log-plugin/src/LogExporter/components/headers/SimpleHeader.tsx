import React from 'react';
import type { LogHeaderProps } from '../../../types';
import { useParsedTags } from '../../hooks/useHeaderHelpers';
import HeaderTags from './HeaderTags';

const SimpleHeader: React.FC<LogHeaderProps> = ({ charInfo, color, headerTags }) => {
  const tags = useParsedTags(headerTags);

  return (
    <header style={{
      paddingBottom: '0.8em',
      marginBottom: '1.6em',
      borderBottom: `1px solid ${color.border}`,
      display: 'flex', alignItems: 'baseline',
      justifyContent: 'space-between',
      flexWrap: 'wrap', gap: '8px',
    }}>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: '10px' }}>
        <h1 style={{
          margin: 0, fontSize: '1.4em',
          color: color.nameColor, fontWeight: 700,
        }}>{charInfo.name}</h1>
        <span style={{
          color: color.textSecondary || color.text,
          fontSize: '0.88em',
        }}>{charInfo.chatName}</span>
      </div>
      <HeaderTags tags={tags} color={color} variant="simple" />
    </header>
  );
};

export default SimpleHeader;
