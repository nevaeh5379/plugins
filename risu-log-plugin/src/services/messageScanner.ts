/**
 * messageScanner.ts — RisuAI Plugin API v3.0 Message Scanning Service
 *
 * Scans and collects chat message DOM nodes from the main document via SafeDocument / SafeElement.
 * Collected SafeElement nodes can later be converted to outerHTML strings and reconstructed
 * as standard HTMLElements inside the plugin iframe.
 */

import { CHAT_CONTENT_SELECTOR } from '../LogExporter/components/constants';

// ============================================================================
// Constants & Selectors
// ============================================================================

/**
 * CSS selector for the primary chat message wrapper generated per message.
 */
const CHAT_CONTAINER_SELECTOR = '.chat-message-container';

/**
 * Class name used to identify message container elements during ancestor traversal.
 */
const CHAT_CONTAINER_CLASS_NAME = 'chat-message-container';

/**
 * CSS selector for candidate standalone chat elements scoped to the main chat screen.
 */
const STANDALONE_CHAT_SELECTOR = '.default-chat-screen .risu-chat';

/**
 * CSS selectors for elements outside the active chat message area
 * (e.g., the plugin's own export modal or the RisuAI sidebar navigation/history).
 */
const EXCLUDED_AREA_SELECTORS = [
  '.log-exporter-modal, .log-exporter-modal *',
  '.risu-sidebar, .risu-sidebar *',
] as const;

/**
 * Maximum ancestor depth to check when determining if a standalone `.risu-chat`
 * element is already contained within a `.chat-message-container`.
 */
const MAX_CONTAINER_ANCESTOR_DEPTH = 5;

/**
 * Regex for extracting the `data-chat-index` attribute value from raw element HTML.
 * Handles single quotes, double quotes, and unquoted numeric values.
 * Example matches: data-chat-index="3", data-chat-index='3', data-chat-index=3
 */
const DATA_CHAT_INDEX_REGEX = /data-chat-index\s*=\s*["']?(\d+)/i;

// ============================================================================
// Types
// ============================================================================

/**
 * Internal interface pairing a DOM SafeElement with its vertical top coordinate for sorting.
 */
interface ElementVerticalPosition {
  element: SafeElement;
  top: number;
}

// ============================================================================
// Helper Utilities
// ============================================================================

/**
 * Determines whether a message node contains actual chat body content.
 *
 * @param node - The SafeElement to inspect
 * @returns True if the element contains content matching `CHAT_CONTENT_SELECTOR`
 */
async function hasMessageContent(node: SafeElement): Promise<boolean> {
  try {
    const prose = await node.querySelector(CHAT_CONTENT_SELECTOR);
    return !!prose;
  } catch {
    return false;
  }
}

/**
 * Determines whether a node is located outside the active chat area
 * (e.g. inside the plugin modal or the RisuAI sidebar).
 *
 * @param node - The SafeElement to inspect
 * @returns True if the element resides within an excluded area
 */
async function isOutsideChatArea(node: SafeElement): Promise<boolean> {
  try {
    for (const selector of EXCLUDED_AREA_SELECTORS) {
      if (await node.matches(selector)) {
        return true;
      }
    }
    return false;
  } catch {
    return false;
  }
}

/**
 * Traverses up the parent chain to check if a node is nested inside a `.chat-message-container`.
 * Used to avoid duplicate message collection when containers already wrap `.risu-chat` nodes.
 *
 * @param node - The SafeElement to check
 * @param maxDepth - Maximum number of ancestor levels to inspect
 * @returns True if an ancestor has the container class name
 */
async function isNestedInContainer(
  node: SafeElement,
  maxDepth = MAX_CONTAINER_ANCESTOR_DEPTH
): Promise<boolean> {
  try {
    let current: SafeElement | null = await node.getParent();
    let depth = 0;

    while (current && depth < maxDepth) {
      const className = await current.getClassName();
      if (className.includes(CHAT_CONTAINER_CLASS_NAME)) {
        return true;
      }
      current = await current.getParent();
      depth++;
    }

    return false;
  } catch {
    return false;
  }
}

/**
 * Evaluates whether a standalone `.risu-chat` node is a valid chat message node:
 * 1. Must contain message body text (`hasMessageContent`).
 * 2. Must not be inside excluded areas such as sidebar or modal (`isOutsideChatArea`).
 * 3. Must not already be wrapped inside a `.chat-message-container` (`isNestedInContainer`).
 *
 * @param chat - Candidate `.risu-chat` SafeElement
 * @returns True if the candidate is a valid standalone message node
 */
async function isValidStandaloneChatNode(chat: SafeElement): Promise<boolean> {
  const hasContent = await hasMessageContent(chat);
  if (!hasContent) {
    return false;
  }

  const isOutside = await isOutsideChatArea(chat);
  if (isOutside) {
    return false;
  }

  const isNested = await isNestedInContainer(chat);
  if (isNested) {
    return false;
  }

  return true;
}

/**
 * Safely extracts the vertical `top` coordinate for an element relative to the viewport.
 * Falls back to `Infinity` on failure so failed elements sort to the end.
 *
 * @param element - The SafeElement to measure
 * @returns Vertical top coordinate in pixels
 */
async function getElementVerticalPosition(element: SafeElement): Promise<number> {
  try {
    const rect = await element.getBoundingClientRect();
    return rect.top;
  } catch {
    return Number.POSITIVE_INFINITY;
  }
}

/**
 * Extracts a numeric `data-chat-index` from an HTML string using regex pattern matching.
 *
 * @param html - Raw HTML string to parse
 * @returns Parsed integer chat index or null if not found
 */
export function extractChatIndexFromHtml(html: string): number | null {
  const match = html.match(DATA_CHAT_INDEX_REGEX);
  if (!match || !match[1]) {
    return null;
  }

  const parsed = parseInt(match[1], 10);
  return Number.isNaN(parsed) ? null : parsed;
}

// ============================================================================
// Public API Functions
// ============================================================================

/**
 * Collects all chat message nodes from the main DOM and sorts them in visual document order.
 *
 * Collection strategy:
 * - Collects all `.chat-message-container` elements (standard wrappers).
 * - Collects standalone `.risu-chat` elements within `.default-chat-screen` that are not already
 *   nested inside a container and not located within sidebars or modals.
 * - Sorts the combined set by `getBoundingClientRect().top` to guarantee proper DOM sequence.
 *
 * @param rootDoc - SafeDocument root of the host window
 * @returns Promise resolving to an array of SafeElement nodes sorted by document order
 */
export async function getAllMessageNodes(rootDoc: SafeDocument): Promise<SafeElement[]> {
  // 1. Collect standard message containers (.chat-message-container)
  const containersRaw = await rootDoc.querySelectorAll(CHAT_CONTAINER_SELECTOR);
  const containers = await Risuai.unwarpSafeArray(containersRaw);

  // 2. Collect candidate standalone chat nodes (.default-chat-screen .risu-chat)
  const candidateChatsRaw = await rootDoc.querySelectorAll(STANDALONE_CHAT_SELECTOR);
  const candidateChats = await Risuai.unwarpSafeArray(candidateChatsRaw);

  // 3. Filter standalone chats that meet valid message criteria
  const validStandaloneChats: SafeElement[] = [];
  for (const chat of candidateChats) {
    if (await isValidStandaloneChatNode(chat)) {
      validStandaloneChats.push(chat);
    }
  }

  // 4. Combine containers and standalone chats
  const allNodes = [...containers, ...validStandaloneChats];

  // 5. Measure vertical top positions and sort by document order
  const positionedNodes: ElementVerticalPosition[] = await Promise.all(
    allNodes.map(async (element) => ({
      element,
      top: await getElementVerticalPosition(element),
    }))
  );

  positionedNodes.sort((a, b) => a.top - b.top);

  return positionedNodes.map((item) => item.element);
}

/**
 * Reads the `data-chat-index` attribute value from a SafeElement.
 *
 * Note: RisuAI v3.0 SafeElement only exposes `x-` prefixed custom attributes through
 * `getAttribute()`. Consequently, `data-chat-index` is extracted via regex from the
 * node's `outerHTML` representation.
 *
 * @param node - The SafeElement to read the chat index from
 * @returns Promise resolving to the integer chat index or null if not present / inaccessible
 */
export async function getChatIndexFromNode(node: SafeElement): Promise<number | null> {
  try {
    const html = await node.getOuterHTML();
    return extractChatIndexFromHtml(html);
  } catch {
    return null;
  }
}