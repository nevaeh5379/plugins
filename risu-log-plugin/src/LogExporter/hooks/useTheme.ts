import { useEffect, useMemo, useRef } from 'react';
import type { ColorPalette, ThemeKey, ColorKey, GlobalSettings } from '../../types';
import { THEMES, COLORS } from '../components/constants';
import type { LogExporterSettings } from './types';

// ─── Constants ──────────────────────────────────────────────────────────────────

/** Default UI theme attribute value when not specified in global settings */
export const DEFAULT_UI_THEME = 'dark';

/** Default theme key for export rendering */
export const DEFAULT_THEME_KEY: ThemeKey = 'basic';

/** Default color palette key for export rendering */
export const DEFAULT_COLOR_KEY: ColorKey = 'dark';

/** Element ID of the React modal root container */
export const MODAL_ROOT_ELEMENT_ID = 'log-exporter-react-modal-root';

/** HTML attribute name used to indicate active UI theme */
export const THEME_DATA_ATTRIBUTE = 'data-theme';

// ─── Palette Resolution ─────────────────────────────────────────────────────────

/**
 * Resolves the appropriate color palette based on theme and color keys.
 *
 * Resolution logic:
 * - `'basic'` theme: resolves color by custom color key (defaulting to `'dark'`).
 * - Preset themes with custom palettes (e.g., `'modern'`, `'smart'`, `'simple'`): uses the theme's built-in palette.
 * - Unknown, unstyled, or custom CSS themes fallback to the `'dark'` palette.
 *
 * @param theme - Theme identifier or key
 * @param color - Color preset identifier or key
 * @returns The resolved ColorPalette
 */
export function resolveColorPalette(
  theme?: ThemeKey | string,
  color?: ColorKey | string,
): ColorPalette {
  const safeThemeKey = theme && theme in THEMES ? (theme as ThemeKey) : DEFAULT_THEME_KEY;
  const themeInfo = THEMES[safeThemeKey] ?? THEMES[DEFAULT_THEME_KEY];

  if (safeThemeKey === 'basic') {
    const safeColorKey = color && color in COLORS ? (color as ColorKey) : DEFAULT_COLOR_KEY;
    return COLORS[safeColorKey] ?? COLORS[DEFAULT_COLOR_KEY];
  }

  return themeInfo.color ?? COLORS[DEFAULT_COLOR_KEY];
}

/**
 * Applies the `data-theme` attribute to the modal container root.
 * NOTE: Never set data-theme on document.body to prevent host app & preview style contamination.
 *
 * @param theme - The active UI theme name (e.g., 'dark', 'light')
 */
export function syncThemeAttributes(theme: string): void {
  if (typeof document === 'undefined') return;

  const rootEl = document.getElementById(MODAL_ROOT_ELEMENT_ID);
  if (rootEl) {
    rootEl.setAttribute(THEME_DATA_ATTRIBUTE, theme);
  }
}

// ─── Hook Interface ─────────────────────────────────────────────────────────────

export interface UseThemeReturn {
  /** The active UI theme (e.g., 'dark', 'light') applied to the modal */
  uiTheme: string;
  /** The resolved color palette for rendering chat messages, bubbles, and text */
  colorPalette: ColorPalette;
  /** Resolved background color shortcut for modal and canvas styling */
  backgroundColor: string;
  /** Mutable ref tracking whether the modal has been closed to prevent duplicate close actions */
  closedRef: React.RefObject<boolean>;
}

// ─── Hook Implementation ────────────────────────────────────────────────────────

/**
 * Hook for managing UI theme synchronization and export color palette resolution.
 *
 * - Synchronizes `data-theme` on document body and modal container.
 * - Computes and memoizes the active `ColorPalette` from theme & color settings.
 * - Provides a lifecycle `closedRef` to guard modal teardown logic.
 *
 * @param settings - Current log exporter settings containing theme and color keys
 * @param globalSettings - Global plugin settings containing UI theme preferences
 * @returns An object containing `uiTheme`, `colorPalette`, `backgroundColor`, and `closedRef`
 */
export function useTheme(
  settings: LogExporterSettings,
  globalSettings: GlobalSettings,
): UseThemeReturn {
  const uiTheme = globalSettings.uiTheme || DEFAULT_UI_THEME;
  const closedRef = useRef<boolean>(false);

  // Synchronize data-theme attribute on document body and modal root
  useEffect(() => {
    syncThemeAttributes(uiTheme);
  }, [uiTheme]);

  // Memoize resolved color palette
  const colorPalette = useMemo(
    () => resolveColorPalette(settings.theme, settings.color),
    [settings.theme, settings.color],
  );

  const backgroundColor = colorPalette.background;

  return {
    uiTheme,
    colorPalette,
    backgroundColor,
    closedRef,
  };
}
