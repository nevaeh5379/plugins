import React from 'react';
import type { MessageProps } from '../../../types';
import BaseMessage, { type ThemeConfig } from './BaseMessage';

const themeConfig: ThemeConfig = {
  // Layout
  marginBottom: 16,
  flexDirection: 'row',
  gap: 14,

  // Avatar
  avatarSize: 44,
  avatarRadius: 12,
  avatarBorder: true,
  avatarMargin: 14,

  // Name (in card header bar)
  showName: true,
  nameFontSize: 0.88,
  nameMarginBottom: 0,
  nameOpacity: 0.9,
  nameColorOverride: false,

  // Card mode
  renderMode: 'card' as const,
  cardBorderRadius: '10px',
  cardPaddingX: 14,
  cardPaddingY: 12,
  nameBarPaddingX: 14,
  nameBarPaddingY: 8,

  // Shared
  lineHeight: 1.75,

  // Delete button
  deleteButtonPlacement: 'inAvatar',
};

const ModernMessage: React.FC<MessageProps> = (props) => (
  <BaseMessage {...props} themeConfig={themeConfig} />
);

export default ModernMessage;
