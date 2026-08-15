import React, { useRef, useEffect, useMemo, useCallback } from 'react';
import type { MessageProps } from '../../../types';
import { useMessageProcessor } from '../../hooks/useMessageProcessor';
import { getNameFromNode } from '../../utils/domUtils';
import { CHAT_CONTENT_SELECTOR } from '../constants';

// ============================================================================
// Constants & Defaults
// ============================================================================

/** Default fallback font size for message cards if not specified in props */
const DEFAULT_BASE_FONT_SIZE = '16px';

/** CSS class name indicating a user message in RisuAI DOM layout */
const USER_MESSAGE_CLASS = 'justify-end';

// ============================================================================
// Types
// ============================================================================

/**
 * Result object returned by the `useMessageCard` hook containing computed state,
 * processed HTML content, author metadata, DOM reference, and interaction handlers.
 */
export interface UseMessageCardResult {
  /** Resolved base font size CSS value (e.g., "16px") */
  baseSize: string;
  /** Processed and sanitized HTML content string ready for rendering */
  messageHtml: string;
  /** DOM ref to the editable content container element */
  contentRef: React.RefObject<HTMLDivElement | null>;
  /** Whether this message was sent by the user (right-aligned) */
  isUser: boolean;
  /** Resolved display name of the message author/character */
  name: string;
  /** Resolved avatar image URL or Data URL for the message author, if available */
  avatarSrc: string | undefined;
  /** Blur event handler for synchronizing inline content edits */
  handleBlur: (e: React.FocusEvent<HTMLDivElement>) => void;
  /** Click event handler to stop propagation during content editing */
  handleContentClick: (e: React.MouseEvent) => void;
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Resolves the CSS font-size string based on user configuration or falls back to default.
 *
 * @param fontSize - Optional font size number in pixels.
 * @returns Formatted CSS pixel string (e.g., "16px").
 */
function resolveBaseFontSize(fontSize?: number): string {
  return typeof fontSize === 'number' && fontSize > 0
    ? `${fontSize}px`
    : DEFAULT_BASE_FONT_SIZE;
}

/**
 * Determines whether a chat DOM node represents a message sent by the user.
 * In RisuAI, user messages are aligned with the `justify-end` flex container class.
 *
 * @param node - The chat message DOM node.
 * @returns `true` if the node has the user message alignment class.
 */
function isUserMessageNode(node: Element | null): boolean {
  return Boolean(node?.classList.contains(USER_MESSAGE_CLASS));
}

// ============================================================================
// Main Hook
// ============================================================================

/**
 * Custom React hook encapsulating common state, content processing, author/avatar
 * resolution, and editing interactions for chat message theme cards.
 *
 * @param props - Message component properties conforming to {@link MessageProps}.
 * @returns Computed values and event handlers conforming to {@link UseMessageCardResult}.
 */
export function useMessageCard(props: MessageProps): UseMessageCardResult {
  const {
    node,
    index,
    charInfoName,
    color,
    embedImagesAsBlob,
    allowHtmlRendering,
    globalSettings,
    isEditable,
    onMessageUpdate,
    onRendered,
    imageScale,
    imageAlign,
    imageStyle,
    replacementRules,
    imageCropActive,
    imageCropAspectRatio,
    imageCropVAlign,
    imageCropHAlign,
    imageCropHeight,
    fontSize,
    avatarMap,
  } = props;

  // 1. Typography & Base sizing
  const baseSize = useMemo(() => resolveBaseFontSize(fontSize), [fontSize]);

  // 2. Locate original message text/content element within the DOM node
  const originalMessageEl = useMemo(
    () => (node ? node.querySelector(CHAT_CONTENT_SELECTOR) : null),
    [node]
  );

  // 3. Process message content (handles image embedding, cropping, styling & regex replacements)
  const messageHtml = useMessageProcessor(
    originalMessageEl,
    embedImagesAsBlob,
    allowHtmlRendering,
    color,
    imageScale,
    onRendered,
    replacementRules,
    imageAlign,
    imageStyle,
    imageCropActive,
    imageCropAspectRatio,
    imageCropVAlign,
    imageCropHAlign,
    imageCropHeight
  );

  // 4. Content DOM reference & HTML synchronization for contentEditable support
  const contentRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (contentRef.current && contentRef.current.innerHTML !== messageHtml) {
      contentRef.current.innerHTML = messageHtml;
    }
  }, [messageHtml]);

  // 5. Author, persona, and avatar resolution
  const isUser = useMemo(() => isUserMessageNode(node), [node]);

  const name = useMemo(() => {
    if (!node) return charInfoName || '';
    return getNameFromNode(node as HTMLElement, globalSettings, charInfoName);
  }, [node, globalSettings, charInfoName]);

  const avatarSrc = useMemo(() => {
    if (!name || !avatarMap) return undefined;
    return avatarMap.get(name);
  }, [avatarMap, name]);

  // 6. Interactive event handlers
  const handleBlur = useCallback(
    (e: React.FocusEvent<HTMLDivElement>) => {
      if (!onMessageUpdate) return;
      const updatedHtml = e.currentTarget.innerHTML;
      if (updatedHtml !== messageHtml) {
        onMessageUpdate(index, updatedHtml);
      }
    },
    [index, messageHtml, onMessageUpdate]
  );

  const handleContentClick = useCallback(
    (e: React.MouseEvent) => {
      if (isEditable) {
        e.stopPropagation();
      }
    },
    [isEditable]
  );

  return {
    baseSize,
    messageHtml,
    contentRef,
    isUser,
    name,
    avatarSrc,
    handleBlur,
    handleContentClick,
  };
}
