// src/LogExporter/utils/domUtils.ts
import type { ReplacementRule, GlobalSettings } from '../../types';

/**
 * Classes representing structured markdown/content blocks that should not be treated as removable UI classes.
 */
const CONTENT_CLASSES_TO_PRESERVE = new Set([
  'x-risu-regex-quote-block',
  'x-risu-regex-thought-block',
  'x-risu-regex-sound-block',
]);

/**
 * Classes related to image containers/cells that should be protected from custom filtering.
 */
const IMAGE_PROTECTED_CLASSES = new Set([
  'x-risu-image-container',
  'x-risu-image-cell',
  'x-risu-asset-table',
  'x-risu-in-table',
]);

/**
 * Safely escapes a CSS class name for use in DOM query selectors.
 * Uses native CSS.escape if available, with a fallback for special characters.
 */
function escapeCssClass(className: string): string {
  if (typeof CSS !== 'undefined' && typeof CSS.escape === 'function') {
    return CSS.escape(className);
  }
  return className.replace(/[!"#$%&'()*+,./:;<=>?@[\]^`{|}~]/g, '\\$&');
}

/**
 * Checks whether an element or any of its descendants contains image or video elements.
 */
function containsMedia(element: Element): boolean {
  return element.querySelector('img, video') !== null;
}

/**
 * Extracts and returns filterable 'x-risu-*' classes from an element's classList.
 */
function extractFilterableRisuClasses(element: Element): string[] {
  return Array.from(element.classList).filter(
    (cls) =>
      cls.startsWith('x-risu-') &&
      !CONTENT_CLASSES_TO_PRESERVE.has(cls) &&
      !IMAGE_PROTECTED_CLASSES.has(cls)
  );
}

/**
 * Extracts participant name from a message DOM node using configured selectors or fallback defaults.
 *
 * Priority order:
 * 1. User-configured participantNameClasses from global settings.
 * 2. Default Risu participant name element (`.unmargin.text-xl`).
 * 3. User message layout flag (`.justify-end` -> '사용자').
 * 4. Default character name (charName fallback, defaults to 'Assistant').
 */
export const getNameFromNode = (
  node: HTMLElement,
  globalSettings?: GlobalSettings,
  charName = 'Assistant'
): string => {
  const participantClasses = globalSettings?.participantNameClasses;
  if (Array.isArray(participantClasses)) {
    for (const cls of participantClasses) {
      if (!cls || typeof cls !== 'string') continue;
      try {
        const escaped = escapeCssClass(cls);
        const el = node.querySelector(`.${escaped}`);
        const text = el?.textContent?.trim();
        if (text) {
          return text;
        }
      } catch (err) {
        console.warn(`[Log Exporter] Invalid class selector for participant name: ${cls}`, err);
      }
    }
  }

  const defaultNameEl = node.querySelector('.unmargin.text-xl');
  const defaultText = defaultNameEl?.textContent?.trim();
  if (defaultText) {
    return defaultText;
  }

  if (node.classList.contains('justify-end')) {
    return '사용자';
  }

  return charName;
};

export interface UIClassInfo {
  name: string;
  displayName: string;
  hasImage: boolean;
}

interface ClassDetail {
  hasImage: boolean;
  parent: string | null;
}

/**
 * Traverses message DOM nodes to discover all custom `x-risu-*` UI classes and their hierarchical structure.
 *
 * @param nodes List of chat message DOM elements.
 * @returns An array of UIClassInfo representing the hierarchy and image status of classes.
 */
export function collectUIClasses(nodes: HTMLElement[]): UIClassInfo[] {
  const classDetails = new Map<string, ClassDetail>();
  const classHierarchy = new Map<string, string[]>();

  nodes.forEach((node) => {
    node.querySelectorAll('*[class*="x-risu-"]').forEach((el) => {
      const currentClasses = extractFilterableRisuClasses(el);
      if (currentClasses.length === 0) return;

      const hasMediaContent = containsMedia(el);

      // Find the nearest ancestor within the current message node that has a filterable risu class
      let parentEl = el.parentElement;
      let parentRisuClass: string | null = null;
      while (parentEl && parentEl !== node) {
        const parentClasses = extractFilterableRisuClasses(parentEl);
        if (parentClasses.length > 0) {
          parentRisuClass = parentClasses[0];
          break;
        }
        parentEl = parentEl.parentElement;
      }

      currentClasses.forEach((className) => {
        let details = classDetails.get(className);
        if (!details) {
          details = { hasImage: false, parent: null };
          classDetails.set(className, details);
        }
        if (hasMediaContent) {
          details.hasImage = true;
        }
        if (parentRisuClass && !details.parent) {
          details.parent = parentRisuClass;
        }
      });
    });
  });

  // Build the hierarchy tree
  const topLevelClasses: string[] = [];
  for (const [className, details] of classDetails.entries()) {
    if (details.parent && classDetails.has(details.parent)) {
      let children = classHierarchy.get(details.parent);
      if (!children) {
        children = [];
        classHierarchy.set(details.parent, children);
      }
      children.push(className);
    } else {
      topLevelClasses.push(className);
    }
  }

  const result: UIClassInfo[] = [];
  const visited = new Set<string>();

  const buildDisplayList = (classNames: string[], depth: number) => {
    const sorted = [...classNames].sort();
    for (const className of sorted) {
      if (visited.has(className)) continue;
      visited.add(className);

      const details = classDetails.get(className);
      if (!details) continue;

      const indent = '  '.repeat(depth * 2);
      const prefix = depth > 0 ? '└ ' : '';
      const imageSuffix = details.hasImage ? ' (이미지 포함)' : '';
      const displayName = `${indent}${prefix}${className}${imageSuffix}`;

      result.push({
        name: className,
        displayName,
        hasImage: details.hasImage,
      });

      const children = classHierarchy.get(className);
      if (children && children.length > 0) {
        buildDisplayList(children, depth + 1);
      }
    }
  };

  buildDisplayList(topLevelClasses, 0);
  return result;
}

/**
 * Locates the main avatar element inside a message DOM node.
 * Checks user-configured profile classes first (excluding inside prose/chattext),
 * then falls back to the default background-image avatar container.
 */
function findMainAvatarElement(
  parentNode: HTMLElement,
  profileClasses?: string[]
): HTMLElement | null {
  if (Array.isArray(profileClasses)) {
    for (const cls of profileClasses) {
      if (!cls || typeof cls !== 'string') continue;
      try {
        const escaped = escapeCssClass(cls);
        const candidates = parentNode.querySelectorAll<HTMLElement>(`.${escaped}`);
        for (const candidate of Array.from(candidates)) {
          if (!candidate.closest('.prose, .chattext')) {
            return candidate;
          }
        }
      } catch {
        // Ignore query errors for invalid class names
      }
    }
  }

  const fallbackAvatarEl = parentNode.querySelector<HTMLElement>(
    '.shadow-lg.rounded-md[style*="background"]'
  );
  if (fallbackAvatarEl && !fallbackAvatarEl.closest('.prose, .chattext')) {
    return fallbackAvatarEl;
  }

  return null;
}

/**
 * Checks whether an element should be protected from deletion (e.g. main avatar or tolog avatar).
 */
function isProtectedElement(
  el: HTMLElement,
  mainAvatarElement: HTMLElement | null
): boolean {
  if (mainAvatarElement && (el === mainAvatarElement || el.contains(mainAvatarElement))) {
    return true;
  }
  if (el.hasAttribute('data-protected-avatar') || el.hasAttribute('data-tolog-avatar')) {
    return true;
  }
  if (el.querySelector('[data-tolog-avatar]')) {
    return true;
  }
  return false;
}

/**
 * Clones a message DOM node and removes elements matching selected custom UI classes,
 * while preserving avatars, content blocks, and protected image containers.
 *
 * @param node The source message DOM element.
 * @param selectedClasses Class names selected to be filtered out.
 * @param globalSettings Plugin global configuration.
 * @returns Cloned and filtered HTMLElement.
 */
export function filterWithCustomClasses(
  node: HTMLElement,
  selectedClasses: string[],
  globalSettings: GlobalSettings
): HTMLElement {
  const tempEl = node.cloneNode(true) as HTMLElement;
  if (!selectedClasses || selectedClasses.length === 0) {
    return tempEl;
  }

  const profileClasses = Array.isArray(globalSettings?.profileClasses)
    ? globalSettings.profileClasses
    : [];
  const profileClassSet = new Set(profileClasses);

  const mainAvatarElement = findMainAvatarElement(tempEl, profileClasses);
  if (mainAvatarElement) {
    mainAvatarElement.setAttribute('data-protected-avatar', 'true');
  }

  for (const className of selectedClasses) {
    if (!className || typeof className !== 'string') continue;

    try {
      const escaped = escapeCssClass(className);
      const matchedElements = tempEl.querySelectorAll<HTMLElement>(`.${escaped}`);

      matchedElements.forEach((el) => {
        if (isProtectedElement(el, mainAvatarElement)) {
          return;
        }
        if (profileClassSet.has(className)) {
          el.remove();
          return;
        }
        if (IMAGE_PROTECTED_CLASSES.has(className)) {
          return;
        }
        el.remove();
      });
    } catch {
      // Ignore query errors
    }
  }

  if (mainAvatarElement) {
    mainAvatarElement.removeAttribute('data-protected-avatar');
  }

  return tempEl;
}

export interface OffscreenContainerResult {
  container: HTMLDivElement;
  remove: () => void;
}

/**
 * Creates an offscreen container detached from visible viewport for rendering or measuring DOM nodes.
 *
 * @param width Optional fixed width in pixels.
 * @returns An object containing the container element and a cleanup `remove` callback.
 */
export function createOffscreenContainer(width?: number): OffscreenContainerResult {
  const container = document.createElement('div');
  container.style.position = 'absolute';
  container.style.top = '-9999px';
  container.style.left = '-9999px';

  if (typeof width === 'number' && width > 0) {
    container.style.width = `${width}px`;
  }

  document.body.appendChild(container);

  return {
    container,
    remove: () => {
      if (container.parentNode) {
        container.parentNode.removeChild(container);
      }
    },
  };
}

interface CompiledReplacementRule {
  apply: (text: string) => string;
}

/** Cache of compiled rules keyed by the source rules array reference. */
const compiledRulesCache = new WeakMap<ReplacementRule[], CompiledReplacementRule[]>();

/**
 * Applies regex and text replacement rules across all text nodes within a root DOM element.
 * Rules are pre-compiled and filtered upfront to maximize performance during DOM tree walking.
 *
 * @param root The root HTMLElement whose text nodes should be processed.
 * @param rules Optional array of replacement rules.
 */
export const applyReplacements = (
  root: HTMLElement,
  rules?: ReplacementRule[]
): void => {
  if (!rules || rules.length === 0) return;

  const cached = compiledRulesCache.get(rules);
  if (cached) {
    if (cached.length === 0) return;
    applyCompiledRules(root, cached);
    return;
  }

  const activeRules: CompiledReplacementRule[] = [];

  for (const rule of rules) {
    if (rule.isEnabled === false || !rule.pattern) continue;

    if (rule.isRegex) {
      try {
        const regex = new RegExp(rule.pattern, rule.flags || 'g');
        const replacement = rule.replacement ?? '';
        activeRules.push({
          apply: (text: string) => text.replace(regex, replacement),
        });
      } catch {
        // Skip invalid regex pattern
      }
    } else {
      const pattern = rule.pattern;
      const replacement = rule.replacement ?? '';
      activeRules.push({
        apply: (text: string) => text.split(pattern).join(replacement),
      });
    }
  }

  if (activeRules.length === 0) {
    compiledRulesCache.set(rules, []);
    return;
  }

  compiledRulesCache.set(rules, activeRules);
  applyCompiledRules(root, activeRules);
};

/**
 * Applies pre-compiled replacement rules across all text nodes within a root DOM element.
 */
function applyCompiledRules(root: HTMLElement, activeRules: CompiledReplacementRule[]): void {
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, null);

  while (walker.nextNode()) {
    const node = walker.currentNode;
    const originalText = node.nodeValue;
    if (!originalText) continue;

    let currentText = originalText;
    for (const rule of activeRules) {
      currentText = rule.apply(currentText);
    }

    if (currentText !== originalText) {
      node.nodeValue = currentText;
    }
  }
}
