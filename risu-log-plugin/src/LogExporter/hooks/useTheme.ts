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

  const antdTheme = useMemo(() => {
    const isDark = uiTheme !== 'light';
    return {
      algorithm: isDark ? antTheme.darkAlgorithm : antTheme.defaultAlgorithm,
      token: {
        fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
        borderRadius: 6,
        borderRadiusSM: 4,
        borderRadiusLG: 8,
        colorPrimary: isDark ? '#3b82f6' : '#2563eb', // Clean slate blue
        colorBgContainer: isDark ? '#18181b' : '#ffffff',
        colorBgElevated: isDark ? '#18181b' : '#ffffff',
        colorBgLayout: isDark ? '#09090b' : '#f4f4f5',
        colorBorder: isDark ? '#27272a' : '#e4e4e7',
        colorBorderSecondary: isDark ? '#27272a' : '#f4f4f5',
        colorText: isDark ? '#f4f4f5' : '#09090b',
        colorTextSecondary: isDark ? '#a1a1aa' : '#71717a',
        colorTextTertiary: isDark ? '#71717a' : '#a1a1aa',
        colorTextQuaternary: isDark ? '#52525b' : '#d4d4d8',
        colorBgSpotlight: isDark ? '#27272a' : '#09090b',
        colorDanger: '#ef4444',
        controlHeight: 34,
        controlHeightSM: 28,
        zIndexPopupBase: 10000,
        motion: false,
      },
      components: {
        Button: {
          fontWeight: 500,
          paddingInline: 12,
          paddingInlineSM: 8,
        },
        Input: {
          paddingInline: 10,
        },
        Tabs: {
          margin: 0,
        },
      },
    };
  }, [uiTheme]);

  return {
    uiTheme,
    colorPalette,
    backgroundColor,
    antdTheme,
    closedRef,
  };
}

