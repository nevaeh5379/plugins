import React from 'react';
import { AVATAR_ATTR } from './constants';

interface AvatarProps {
  avatarSrc?: string;
  name: string;
  isUser: boolean;
  isForArca: boolean;
  showAvatar: boolean;
  baseStyle: React.CSSProperties;
  marginStyle: React.CSSProperties;
  isForExport?: boolean;
}

const Avatar: React.FC<AvatarProps> = ({ avatarSrc, name, isUser, isForArca, showAvatar, baseStyle, marginStyle, isForExport }) => {
  if (!showAvatar) return null;

  const fullStyle = { ...baseStyle, ...marginStyle };

  const renderPlaceholder = () => {
    const letter = isUser ? 'U' : name.charAt(0).toUpperCase();
    return (
      <div {...{ [AVATAR_ATTR]: '' }} style={{
        ...fullStyle,
        backgroundColor: '#3a3f4a',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        <span style={{ color: '#c0c5cf', fontWeight: 600, fontSize: '1.1em' }}>{letter}</span>
      </div>
    );
  };

  if (isForArca || isForExport) {
    if (!avatarSrc) return renderPlaceholder();
    return <img {...{ [AVATAR_ATTR]: '' }} data-user={isUser} style={fullStyle} src={avatarSrc} />;
  }

  if (avatarSrc) {
    return <div {...{ [AVATAR_ATTR]: '' }} style={{
      ...fullStyle,
      backgroundImage: `url('${avatarSrc}')`,
      backgroundSize: 'cover', backgroundPosition: 'center',
    }} />;
  }

  return renderPlaceholder();
};

export default Avatar;