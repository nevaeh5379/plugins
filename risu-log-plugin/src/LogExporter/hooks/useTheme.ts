import { useEffect, useMemo, useRef } from 'react';
import { theme as antTheme } from 'antd';
import type { ColorPalette, ThemeKey, ColorKey, GlobalSettings } from '../../types';
import { THEMES, COLORS } from '../components/constants';
import type { LogExporterSettings } from './types';

export function useTheme(settings: LogExporterSettings, globalSettings: GlobalSettings) {
  const uiTheme = (globalSettings.uiTheme as string) || 'dark';
  const closedRef = useRef(false);

  // Apply data-theme attribute
  useEffect(() => {
    document.body.setAttribute('data-theme', uiTheme);
    const rootEl = document.getElementById('log-exporter-react-modal-root');
    if (rootEl) {
      rootEl.setAttribute('data-theme', uiTheme);
    }
  }, [uiTheme]);

  const colorPalette = useMemo((): ColorPalette => {
    const themeKey = (settings.theme as ThemeKey) || 'basic';
    const themeInfo = THEMES[themeKey] || THEMES.basic;
    return themeKey === 'basic'
      ? (COLORS[(settings.color as ColorKey) || 'dark'] || COLORS.dark)
      : (themeInfo.color || COLORS.dark);
  }, [settings.theme, settings.color]);

  const backgroundColor = colorPalette.background;

  const antdTheme = useMemo(() => ({
    algorithm: uiTheme === 'light' ? antTheme.defaultAlgorithm : antTheme.darkAlgorithm,
    token: {
      colorPrimary: '#61afef',
      motion: false,
    } as const,
  }), [uiTheme]);

  return {
    uiTheme,
    colorPalette,
    backgroundColor,
    antdTheme,
    closedRef,
  };
}
