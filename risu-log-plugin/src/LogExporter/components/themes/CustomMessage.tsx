import React from 'react';
import type { MessageProps } from '../../../types';
import BaseMessage, { type ThemeConfig } from './BaseMessage';

const themeConfig: ThemeConfig = {
  // Layout
  marginBottom: 28,
  flexDirection: 'row',
  avatarMargin: 12,

  // Avatar
  avatarSize: 48,
  avatarRadius: '50%',
  avatarBorder: true,

  // Name
  showName: true,
  nameFontSize: 0.94,
  nameMarginBottom: 8,
  nameOpacity: 1,
  nameColorOverride: true,

  // Bubble
  bubbleRadius: '16px',
  bubblePaddingX: 18,
  bubblePaddingY: 14,

  // Non-bubble
  nobubblePaddingX: 4,
  nobubblePaddingY: 0,

  // Shared
  lineHeight: 1.8,

  // Delete button
  deleteButtonPlacement: 'beforeAvatar',
};

const CustomMessage: React.FC<MessageProps> = (props) => (
  <BaseMessage {...props} themeConfig={themeConfig} />
);

export default CustomMessage;
