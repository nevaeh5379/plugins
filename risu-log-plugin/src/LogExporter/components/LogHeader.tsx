import React from 'react';
import type { LogHeaderProps as BaseLogHeaderProps } from '../../types';

import DefaultHeader from './headers/DefaultHeader';
import CompactHeader from './headers/CompactHeader';
import BannerHeader from './headers/BannerHeader';
import SmartHeader from './headers/SmartHeader';
import SimpleHeader from './headers/SimpleHeader';
import ModernHeader from './headers/ModernHeader';
import LogThemeHeader from './headers/LogThemeHeader';
import CoverHeader from './headers/CoverHeader';

/**
 * Supported layout options for customizable headers.
 */
export type HeaderLayout = 'default' | 'compact' | 'banner' | 'smart' | 'cover';

/**
 * Props for the LogHeader dispatcher component.
 * Extends the base header props with theme and layout configuration.
 */
export interface LogHeaderProps extends BaseLogHeaderProps {
  /** Selected theme key (e.g., 'basic', 'smart', 'simple', 'modern', 'log', 'custom') */
  themeKey?: string;
  /** Chosen layout for customizable themes */
  layout?: HeaderLayout;
}

/**
 * Dedicated header components for specific themes.
 * When a theme is specified here, it takes precedence over the layout setting.
 */
const THEME_HEADER_MAP: Readonly<Record<string, React.ComponentType<BaseLogHeaderProps>>> = {
  smart: SmartHeader,
  simple: SimpleHeader,
  modern: ModernHeader,
  log: LogThemeHeader,
};

/**
 * Layout-to-header mapping for customizable themes ('basic', 'custom', etc.).
 */
const LAYOUT_HEADER_MAP: Readonly<Record<HeaderLayout, React.ComponentType<BaseLogHeaderProps>>> = {
  default: DefaultHeader,
  compact: CompactHeader,
  banner: BannerHeader,
  smart: SmartHeader,
  cover: CoverHeader,
};

/**
 * Resolves the appropriate header component based on active theme and layout configuration.
 *
 * Precedence:
 * 1. Dedicated theme headers ('smart', 'simple', 'modern', 'log') override layout settings.
 * 2. Layout-specific headers ('default', 'compact', 'banner', 'smart', 'cover') for basic/custom themes.
 * 3. Fallback to `DefaultHeader`.
 */
function getHeaderComponent(
  themeKey?: string,
  layout?: HeaderLayout
): React.ComponentType<BaseLogHeaderProps> {
  if (themeKey && themeKey in THEME_HEADER_MAP) {
    return THEME_HEADER_MAP[themeKey];
  }

  if (layout && layout in LAYOUT_HEADER_MAP) {
    return LAYOUT_HEADER_MAP[layout];
  }

  return DefaultHeader;
}

/**
 * LogHeader component.
 *
 * Dispatcher component that selects and renders the appropriate header
 * layout based on the current theme key and user-selected header layout.
 */
const LogHeader: React.FC<LogHeaderProps> = ({
  themeKey = 'basic',
  layout = 'default',
  ...headerProps
}) => {
  const HeaderComponent = getHeaderComponent(themeKey, layout);

  return <HeaderComponent {...headerProps} />;
};

LogHeader.displayName = 'LogHeader';

export default React.memo(LogHeader);
