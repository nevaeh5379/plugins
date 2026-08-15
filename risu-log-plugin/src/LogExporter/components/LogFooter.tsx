import React, { lazy, Suspense } from 'react';
import type { FooterProps, ThemeKey } from '../../types';
import DefaultFooter from './footers/DefaultFooter';

const SmartFooter = lazy(() => import('./footers/SmartFooter'));
const SimpleFooter = lazy(() => import('./footers/SimpleFooter'));
const ModernFooter = lazy(() => import('./footers/ModernFooter'));
const LogThemeFooter = lazy(() => import('./footers/LogThemeFooter'));

/**
 * Mapping of theme keys to their dedicated lazy-loaded footer components.
 * Themes without a dedicated footer component fall back to `DefaultFooter`.
 */
const FOOTER_COMPONENTS: Partial<Record<ThemeKey, React.ComponentType<FooterProps>>> = {
  smart: SmartFooter,
  simple: SimpleFooter,
  modern: ModernFooter,
  log: LogThemeFooter,
};

export interface LogFooterProps extends FooterProps {
  themeKey?: ThemeKey;
}

/**
 * LogFooter - Variant dispatcher component for log exporter footers.
 * Dynamically resolves and renders the appropriate themed footer based on `themeKey`.
 */
const LogFooter: React.FC<LogFooterProps> = ({
  themeKey,
  ...footerProps
}) => {
  const FooterComponent = (themeKey && FOOTER_COMPONENTS[themeKey]) || DefaultFooter;

  return (
    <Suspense fallback={<div />}>
      <FooterComponent {...footerProps} />
    </Suspense>
  );
};

LogFooter.displayName = 'LogFooter';

export { LogFooter };
export default React.memo(LogFooter);

