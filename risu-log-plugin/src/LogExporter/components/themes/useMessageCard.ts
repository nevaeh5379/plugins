import { useRef, useEffect } from 'react';
import type { MessageProps } from '../../../types';
import { useMessageProcessor } from '../../hooks/useMessageProcessor';
import { getNameFromNode } from '../../utils/domUtils';

export interface UseMessageCardResult {
  baseSize: string;
  messageHtml: string;
  contentRef: React.RefObject<HTMLDivElement | null>;
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
  const originalMessageEl = node.querySelector('.prose, .chattext');

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

  const contentRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (contentRef.current && messageHtml !== contentRef.current.innerHTML) {
      contentRef.current.innerHTML = messageHtml;
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
