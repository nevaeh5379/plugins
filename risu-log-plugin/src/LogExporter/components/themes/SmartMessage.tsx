import React from 'react';
import type { MessageProps } from '../../../types';
import BaseMessage, { type ThemeConfig } from './BaseMessage';

const themeConfig: ThemeConfig = {
  // Layout
  marginBottom: 20,
  flexDirection: 'row',
  gap: 4,
  containerPaddingX: 4,

  // Avatar
  avatarSize: 40,
  avatarRadius: '50%',
  avatarBorder: false,
  avatarMargin: 10,

  // Name (shown above card, only for non-user)
  showName: true,
  nameFontSize: 0.88,
  nameMarginBottom: 4,
  nameOpacity: 0.85,
  nameShowForUser: false,

  // Card mode
  renderMode: 'card' as const,
  cardBorderRadius: '4px 16px 16px 16px',
  cardBorderRadiusUser: '16px 4px 16px 16px',
  cardPaddingX: 14,
  cardPaddingY: 10,
  cardShadow: '0 2px 12px rgba(0,0,0,0.06)',
  cardBackdropFilter: true,
  nameInHeader: false,

  // Shared
  lineHeight: 1.7,

  // Delete button
  deleteButtonPlacement: 'inAvatar' as const,
  deleteButtonOpposite: true,
  deleteButtonStyle: {
    width: '18px',
    height: '18px',
    fontSize: '12px',
    top: '-5px',
  },
};

const SmartMessage: React.FC<MessageProps> = (props) => (
  <BaseMessage {...props} themeConfig={themeConfig} />
);

export default SmartMessage;
