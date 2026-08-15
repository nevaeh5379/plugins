import type { GlobalSettings } from '../../types';
import { getNameFromNode } from '../utils/domUtils';
import { imageUrlToBlob, extractBackgroundImageUrl } from '../utils/imageUtils';

/**
 * CSS selectors for elements containing message text/content where background images
 * or custom profile classes should NOT be treated as character avatars.
 */
const CONTENT_CONTAINER_SELECTOR = '.prose, .chattext';

/**
 * Safely escapes a CSS class name for use in DOM query selectors.
 * Uses native `CSS.escape` when available, with a fallback for special characters.
 */
function escapeCssClass(className: string): string {
  if (typeof CSS !== 'undefined' && typeof CSS.escape === 'function') {
    return CSS.escape(className);
  }
  return className.replace(/[!"#$%&'()*+,./:;<=>?@[\]^`{|}~]/g, '\\$&');
}

/**
 * Checks whether an element is located inside a message content container (prose / chattext).
 */
function isContentDescendant(element: HTMLElement): boolean {
  return element.closest(CONTENT_CONTAINER_SELECTOR) !== null;
}

/**
 * Searches within a DOM node for the first element matching a CSS selector
 * that is not a descendant of message content containers.
 */
function findFirstValidElement(root: Element, selector: string): HTMLElement | null {
  try {
    const candidates = root.querySelectorAll<HTMLElement>(selector);
    for (let i = 0; i < candidates.length; i++) {
      const candidate = candidates[i];
      if (!isContentDescendant(candidate)) {
        return candidate;
      }
    }
  } catch {
    // Ignore invalid selector syntax or query errors
  }
  return null;
}

/**
 * Locates the avatar HTMLElement inside a message DOM node.
 *
 * Discovery strategy:
 * 1. User-configured custom profile classes from global settings (if any).
 * 2. Generic element with an inline background style (`[style*="background"]`).
 *
 * In all cases, elements inside `.prose` or `.chattext` are excluded.
 */
export function findAvatarElementInNode(
  node: Element,
  profileClasses?: string[]
): HTMLElement | null {
  // 1. Try user-defined profile classes first
  if (Array.isArray(profileClasses)) {
    for (const cls of profileClasses) {
      if (!cls || typeof cls !== 'string') continue;
      const trimmed = cls.trim();
      if (!trimmed) continue;

      const element = findFirstValidElement(node, `.${escapeCssClass(trimmed)}`);
      if (element) {
        return element;
      }
    }
  }

  // 2. Fallback: Generic background style element
  return findFirstValidElement(node, '[style*="background"]');
}

/**
 * Extracts the background image URL from an avatar DOM element.
 */
export function extractAvatarUrlFromElement(element: HTMLElement | null): string {
  if (!element) return '';
  const backgroundStyle = element.style?.backgroundImage;
  if (!backgroundStyle) return '';
  return extractBackgroundImageUrl(backgroundStyle) || '';
}

/**
 * Converts a raw avatar image URL to a format suitable for client display and export.
 * For Arcalive exports, URLs remain unconverted.
 * For standard exports/previews, converts to Data URL (base64) to bypass iframe CSP.
 *
 * @param url The raw image URL.
 * @param isForArca Whether the log is being prepared for Arcalive export.
 * @returns Converted data URL or original URL, or empty string on failure.
 */
export async function resolveAvatarImageUrl(
  url: string,
  isForArca: boolean
): Promise<string> {
  if (!url) return '';
  if (isForArca) return url;

  try {
    return await imageUrlToBlob(url);
  } catch (error) {
    console.error(`[avatarService] Failed to convert image URL to Data URL: ${url}`, error);
    return '';
  }
}

/**
 * Scans message DOM nodes to discover character avatar URLs for each participant,
 * converts them into Data URLs (or preserves them for Arcalive), and returns a Map
 * mapping participant names to their resolved avatar URLs.
 *
 * @param nodes List of chat message DOM elements.
 * @param charInfoName Fallback character name if node has no participant name.
 * @param isForArca Whether exporting for Arcalive (skips Data URL conversion).
 * @param globalSettings Plugin global configuration containing profileClasses.
 * @returns A Promise resolving to a Map of character name -> avatar URL.
 */
export const collectCharacterAvatars = async (
  nodes: Element[],
  charInfoName: string,
  isForArca: boolean,
  globalSettings?: GlobalSettings
): Promise<Map<string, string>> => {
  const avatarMap = new Map<string, string>();
  const avatarPromises = new Map<string, Promise<string>>();
  const profileClasses = globalSettings?.profileClasses;

  for (const node of nodes) {
    const name = getNameFromNode(node as HTMLElement, globalSettings, charInfoName);
    if (!name || avatarMap.has(name) || avatarPromises.has(name)) {
      continue;
    }

    const avatarElement = findAvatarElementInNode(node, profileClasses);
    const avatarUrl = extractAvatarUrlFromElement(avatarElement);

    if (avatarUrl) {
      avatarPromises.set(name, resolveAvatarImageUrl(avatarUrl, isForArca));
    }
  }

  if (avatarPromises.size === 0) {
    return avatarMap;
  }

  // Await all avatar conversions concurrently
  const entries = Array.from(avatarPromises.entries());
  const resolved = await Promise.all(
    entries.map(async ([name, promise]) => {
      const url = await promise;
      return [name, url] as const;
    })
  );

  for (const [name, url] of resolved) {
    avatarMap.set(name, url);
  }

  return avatarMap;
};

