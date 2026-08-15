import { useEffect, useState } from 'react';

/**
 * Default fallback viewport width (in pixels) used when `window` is unavailable (e.g., during SSR)
 * or when `window.innerWidth` is not yet available.
 */
export const DEFAULT_WINDOW_WIDTH = 1200;

/**
 * Staggered delay intervals (in ms) to re-measure viewport width after mounting.
 * This accommodates scenarios where the plugin iframe or container transitions from
 * `display: none` to `display: block` or animates into view.
 */
const IFRAME_TRANSITION_DELAYS_MS = [50, 150, 300] as const;

/**
 * Safely retrieves the current window width in browser and non-browser environments.
 *
 * @param fallback - Fallback width to use when `window` is not defined or `innerWidth` is falsy.
 * @returns The current `window.innerWidth` or the fallback value.
 */
function getWindowWidth(fallback: number): number {
  if (typeof window === 'undefined') {
    return fallback;
  }
  return window.innerWidth || fallback;
}

/**
 * React hook that tracks and returns the current window width in pixels.
 *
 * Features:
 * - SSR-safe with customizable initial fallback width.
 * - Actively listens to `resize` events on the `window` object.
 * - Performs staggered re-measurements on mount to handle iframe visibility transitions (`display: none` -> `block`).
 * - Cleans up all listeners and scheduled timers on unmount.
 *
 * @param initialWidth - Fallback width in pixels before measurement or in non-browser environments. Defaults to 1200.
 * @returns The current viewport width in pixels.
 */
export function useWindowWidth(initialWidth: number = DEFAULT_WINDOW_WIDTH): number {
  const [width, setWidth] = useState<number>(() => getWindowWidth(initialWidth));

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }

    const handleResize = () => {
      const currentWidth = getWindowWidth(initialWidth);
      setWidth((prevWidth) => (prevWidth === currentWidth ? prevWidth : currentWidth));
    };

    window.addEventListener('resize', handleResize, { passive: true });
    // Initial sync on mount in case dimensions changed between initial render and effect run
    handleResize();

    // Re-measure across layout settlement intervals (e.g. iframe transitions)
    const timers = IFRAME_TRANSITION_DELAYS_MS.map((delay) =>
      setTimeout(handleResize, delay)
    );

    return () => {
      window.removeEventListener('resize', handleResize);
      timers.forEach((timerId) => clearTimeout(timerId));
    };
  }, [initialWidth]);

  return width;
}
