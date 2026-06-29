import { useCallback } from 'react';
import type { MessageProps } from '../../../types';
import { useMessageProcessor } from '../../hooks/useMessageProcessor';
import { getNameFromNode } from '../../utils/domUtils';

import { CHAT_CONTENT_SELECTOR } from '../constants';

export interface UseMessageCardResult {
  baseSize: string;
  messageHtml: string;
  contentRef: (node: HTMLDivElement | null) => void;
  isUser: boolean;
  name: string;
  avatarSrc: string | undefined;
  handleBlur: (e: React.FocusEvent<HTMLDivElement>) => void;
  handleContentClick: (e: React.MouseEvent) => void;
}

export function useMessageCard(
  props: MessageProps
): UseMessageCardResult {
  const {
    node, index, charInfoName, color, embedImagesAsBlob,
    allowHtmlRendering, globalSettings, isEditable, onMessageUpdate,
    imageScale, imageAlign, imageStyle, replacementRules,
    imageCropActive, imageCropAspectRatio, imageCropVAlign,
    imageCropHAlign, imageCropHeight, fontSize,
  } = props;

  const baseSize = fontSize ? `${fontSize}px` : '16px';
  const originalMessageEl = node.querySelector(CHAT_CONTENT_SELECTOR);

  const messageHtml = useMessageProcessor(
    originalMessageEl,
    embedImagesAsBlob,
    allowHtmlRendering,
    color,
    imageScale,
    props.onRendered,
    replacementRules,
    imageAlign,
    imageStyle,
    imageCropActive,
    imageCropAspectRatio,
    imageCropVAlign,
    imageCropHAlign,
    imageCropHeight
  );

  const contentRef = useCallback((node: HTMLDivElement | null) => {
    if (node && messageHtml !== node.innerHTML) {
      node.innerHTML = messageHtml;
    }
  }, [messageHtml]);

  const isUser = node.classList.contains('justify-end');
  const name = getNameFromNode(node as HTMLElement, globalSettings, charInfoName);
  const avatarSrc = props.avatarMap.get(name);

  const handleBlur = (e: React.FocusEvent<HTMLDivElement>) => {
    if (onMessageUpdate && e.currentTarget.innerHTML !== messageHtml) {
      onMessageUpdate(index, e.currentTarget.innerHTML);
    }
  };

  const handleContentClick = (e: React.MouseEvent) => {
    if (isEditable) {
      e.stopPropagation();
    }
  };

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
