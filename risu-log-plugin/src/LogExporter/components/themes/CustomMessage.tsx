import React, { useMemo } from 'react';
import type { MessageProps } from '../../../types';
import BaseMessage, { type ThemeConfig } from './BaseMessage';

/**
 * Props for the CustomMessage component, supporting optional custom theme configuration overrides.
 */
export interface CustomMessageProps extends MessageProps {
  /**
   * Optional custom theme configuration overrides for fine-grained style injection.
   */
  customThemeConfig?: Partial<ThemeConfig>;
}

/**
 * Default configuration for the 'custom' message theme preset.
 * Features a spacious layout, larger circular avatars, and prominent message bubbles.
 */
const DEFAULT_CUSTOM_THEME_CONFIG: ThemeConfig = Object.freeze({
  // Layout
  marginBottom: 28,
  flexDirection: 'row',
  avatarMargin: 12,

  // Avatar
  avatarSize: 48,
  avatarRadius: '50%',
  avatarBorder: true,

  // Name / Header
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

  // Shared typography
  lineHeight: 1.8,

  // Delete button
  deleteButtonPlacement: 'beforeAvatar',
});

/**
 * CustomMessage component renders chat log messages using the 'custom' theme preset.
 * Allows custom theme styling injection via the `customThemeConfig` prop.
 */
const CustomMessage: React.FC<CustomMessageProps> = ({
  customThemeConfig,
  ...baseProps
}) => {
  const resolvedThemeConfig = useMemo<ThemeConfig>(() => {
    if (!customThemeConfig || Object.keys(customThemeConfig).length === 0) {
      return DEFAULT_CUSTOM_THEME_CONFIG;
    }
    return {
      ...DEFAULT_CUSTOM_THEME_CONFIG,
      ...customThemeConfig,
    };
  }, [customThemeConfig]);

  return <BaseMessage {...baseProps} themeConfig={resolvedThemeConfig} />;
};

CustomMessage.displayName = 'CustomMessage';

export default CustomMessage;
