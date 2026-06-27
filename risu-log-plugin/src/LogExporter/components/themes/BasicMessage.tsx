import React from 'react';
import type { MessageProps } from '../../../types';
import BaseMessage, { type ThemeConfig } from './BaseMessage';

const themeConfig: ThemeConfig = {
  // Layout
  marginBottom: 24,
  flexDirection: 'row',
  avatarMargin: 14,

  // Avatar
  avatarSize: 44,
  avatarRadius: '50%',
  avatarBorder: true,

  // Name
  showName: true,
  nameFontSize: 0.88,
  nameMarginTop: 2,
  nameMarginBottom: 6,
  nameOpacity: 0.85,

  // Bubble
  bubbleRadius: '16px',
  bubbleRadiusUser: '16px 4px 16px 16px',
  bubblePaddingX: 16,
  bubblePaddingY: 12,

  // Non-bubble
  nobubblePaddingX: 4,
  nobubblePaddingY: 2,

  // Shared
  lineHeight: 1.75,

  // Delete button
  deleteButtonPlacement: 'beforeAvatar',
};

const BasicMessage: React.FC<MessageProps> = (props) => (
  <BaseMessage {...props} themeConfig={themeConfig} />
);

export default BasicMessage;
