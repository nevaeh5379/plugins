import React from 'react';
import type { MessageProps } from '../../../types';
import BaseMessage, { type ThemeConfig } from './BaseMessage';

/**
 * Theme configuration for the "Modern" chat message theme.
 *
 * Characteristics:
 * - Layout: Horizontal flex layout with a modern card container.
 * - Avatar: Squircle-styled rounded corners (12px radius) with border outline.
 * - Card Mode: Enclosed card container with distinct inner header bar for character name.
 * - Name Header: Displayed in a dedicated header bar at the top of the message card.
 * - Delete Button: Positioned neatly over the avatar in editable mode.
 */
const MODERN_THEME_CONFIG: ThemeConfig = {
  // Layout & Spacing
  marginBottom: 16,
  flexDirection: 'row',
  gap: 14,
  avatarMargin: 14,

  // Avatar Styling
  avatarSize: 44,
  avatarRadius: 12,
  avatarBorder: true,

  // Name Header Bar
  showName: true,
  nameFontSize: 0.88,
  nameMarginBottom: 0,
  nameOpacity: 0.9,
  nameColorOverride: false,

  // Card Mode & Layout
  renderMode: 'card',
  nameInHeader: true,
  cardBorderRadius: '10px',
  cardPaddingX: 14,
  cardPaddingY: 12,
  nameBarPaddingX: 14,
  nameBarPaddingY: 8,

  // Typography & Shared
  lineHeight: 1.75,

  // Actions & Controls
  deleteButtonPlacement: 'inAvatar',
};

/**
 * ModernMessage component.
 * Renders a chat message with a sleek modern card layout featuring an integrated header bar.
 */
const ModernMessage: React.FC<MessageProps> = (props) => (
  <BaseMessage {...props} themeConfig={MODERN_THEME_CONFIG} />
);

ModernMessage.displayName = 'ModernMessage';

export default ModernMessage;

