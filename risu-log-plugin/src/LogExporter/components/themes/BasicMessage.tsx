import React from 'react';
import type { MessageProps } from '../../../types';
import BaseMessage, { type ThemeConfig } from './BaseMessage';

/**
 * Theme configuration for the "Basic" chat message theme.
 *
 * Characteristics:
 * - Layout: Standard horizontal row with avatar on left/right depending on user status.
 * - Avatar: Circular (50% radius) with border outline.
 * - Name: Displayed above the message bubble with moderate opacity.
 * - Bubble: Classic rounded bubbles with asymmetrical top-right corner for user messages.
 * - Delete button: Placed before the avatar in editable mode.
 */
const BASIC_THEME_CONFIG: ThemeConfig = {
  // Layout & Spacing
  marginBottom: 24,
  flexDirection: 'row',
  avatarMargin: 14,

  // Avatar Styling
  avatarSize: 44,
  avatarRadius: '50%',
  avatarBorder: true,

  // Author / Character Name
  showName: true,
  nameFontSize: 0.88,
  nameMarginTop: 2,
  nameMarginBottom: 6,
  nameOpacity: 0.85,

  // Message Bubble Styling
  renderMode: 'bubble',
  bubbleRadius: '16px',
  bubbleRadiusUser: '16px 4px 16px 16px',
  bubblePaddingX: 16,
  bubblePaddingY: 12,

  // Non-bubble Fallback (when showBubble is disabled)
  nobubblePaddingX: 4,
  nobubblePaddingY: 2,

  // Typography & Shared Properties
  lineHeight: 1.75,

  // Actions & Controls
  deleteButtonPlacement: 'beforeAvatar',
};

/**
 * BasicMessage component.
 * Renders a chat message using the default / basic theme layout.
 */
const BasicMessage: React.FC<MessageProps> = (props) => (
  <BaseMessage {...props} themeConfig={BASIC_THEME_CONFIG} />
);

export default BasicMessage;
