import { useState, useEffect, useRef } from 'react';
import { imageUrlToBlob, extractBackgroundImageUrl } from '../utils/imageUtils';
import { applyReplacements } from '../utils/domUtils';
import { showWarning } from '../utils/notify';
import type { ColorPalette, ReplacementRule, ImageStyle } from '../../types';

// ==========================================
// Constants & Lookups
// ==========================================

const PLACEHOLDER_CAPTIONS = new Set([
  'character portrait',
  'character-portrait',
  'image',
  'avatar',
  'user portrait',
  'user-portrait',
  'attachment',
  'file',
  'portrait',
]);

const FILE_EXTENSION_REGEX = /\.(png|jpe?g|webp|gif|bmp)$/i;
const HASH_FILENAME_REGEX = /^[a-f0-9\-_]+$/i;

// ==========================================
// Types
// ==========================================

type BackgroundImageHandler = (
  element: HTMLElement,
  bgUrl: string,
  embedImages: boolean
) => Promise<void>;

export interface MessageProcessorOptions {
  imageScale?: number;
  imageAlign?: 'left' | 'center' | 'right';
  imageStyle?: ImageStyle;
  imageCropActive?: boolean;
  imageCropAspectRatio?: string;
  imageCropVAlign?: number;
  imageCropHAlign?: number;
  imageCropHeight?: number;
}

interface FullMessageProcessingOptions extends MessageProcessorOptions {
  originalMessageEl: Element;
  embedImages: boolean;
  color: ColorPalette;
  replacementRules?: ReplacementRule[];
}

// ==========================================
// Helper Utilities
// ==========================================

/**
 * Determines if a message node can be processed synchronously without spawning async tasks.
 */
const canProcessSynchronously = (
  originalMessageEl: Element | null,
  replacementRules?: ReplacementRule[]
): boolean => {
  if (!originalMessageEl) return true;

  // Active replacement rules require DOM traversal and string replacements.
  if (replacementRules && replacementRules.length > 0) return false;

  // Images, video, background styles, regex formats, and buttons require processing.
  const hasSpecialElements = originalMessageEl.querySelector(
    'img, video, [style*="background-image"], button, .log-exporter-msg-btn-group, .x-risu-regex-quote-block, .x-risu-regex-thought-block, mark[risu-mark^="quote"]'
  );

  return !hasSpecialElements;
};

/**
 * Traverses an element and converts image sources / background images to data URLs / blobs.
 */
const embedImagesInElement = async (
  element: HTMLElement,
  embedImages: boolean,
  onBackgroundImage: BackgroundImageHandler
): Promise<void> => {
  const mediaElements = Array.from(
    element.querySelectorAll<HTMLElement>('img, [style*="background-image"]')
  );

  const mediaPromises = mediaElements.map(async (el) => {
    if (el.tagName === 'IMG') {
      const img = el as HTMLImageElement;
      if (img.src && embedImages && !img.src.startsWith('data:') && !img.src.startsWith('blob:')) {
        try {
          img.src = await imageUrlToBlob(img.src);
        } catch (e) {
          console.error('[log plugin] Failed to embed image as blob:', img.src, e);
          const truncated = img.src.length > 80 ? `${img.src.substring(0, 80)}...` : img.src;
          showWarning(`이미지 임베딩 실패: ${truncated}`);
        }
      }
    } else {
      const style = el.getAttribute('style');
      const bgUrl = style ? extractBackgroundImageUrl(style) : null;
      if (bgUrl) {
        await onBackgroundImage(el, bgUrl, embedImages);
      }
    }
  });

  await Promise.all(mediaPromises);
};

/**
 * Retains background-image CSS property while embedding url as blob.
 */
const keepBackgroundImage: BackgroundImageHandler = async (element, bgUrl, embedImages) => {
  if (embedImages && !bgUrl.startsWith('data:') && !bgUrl.startsWith('blob:')) {
    try {
      const convertedUrl = await imageUrlToBlob(bgUrl);
      element.style.backgroundImage = `url("${convertedUrl}")`;
    } catch (e) {
      console.error('[log plugin] Failed to embed background image as blob:', bgUrl, e);
      const truncated = bgUrl.length > 80 ? `${bgUrl.substring(0, 80)}...` : bgUrl;
      showWarning(`배경 이미지 임베딩 실패: ${truncated}`);
    }
  }
};

/**
 * Replaces a background-image element with an <img> tag.
 */
const replaceBackgroundWithImg: BackgroundImageHandler = async (element, bgUrl, embedImages) => {
  const img = document.createElement('img');
  try {
    img.src = embedImages ? await imageUrlToBlob(bgUrl) : bgUrl;
  } catch (e) {
    console.error('[log plugin] Failed to convert background to img src:', bgUrl, e);
    img.src = bgUrl;
  }
  element.parentNode?.insertBefore(img, element);
  element.remove();
};

/**
 * Checks whether an image alt attribute represents a user-provided custom caption.
 */
const isCustomCaption = (alt: string | null | undefined): boolean => {
  if (!alt) return false;
  const trimmed = alt.trim();
  if (!trimmed) return false;
  const lower = trimmed.toLowerCase();

  if (PLACEHOLDER_CAPTIONS.has(lower)) return false;

  // Path shapes (containing slashes) and RisuAI virtual path filtering
  if (lower.startsWith('/sw/') || lower.includes('/') || lower.includes('\\')) return false;
  if (lower.startsWith('http://') || lower.startsWith('https://')) return false;
  if (lower.startsWith('data:') || lower.startsWith('blob:')) return false;

  // File extension and random hash filename filtering
  if (FILE_EXTENSION_REGEX.test(lower)) return false;
  if (HASH_FILENAME_REGEX.test(lower) && lower.length > 8) return false;

  return true;
};

/**
 * Converts aspect ratio presets or custom heights into CSS aspect-ratio values.
 */
const getAspectRatioCssValue = (aspectRatio?: string, customHeight?: number): string => {
  switch (aspectRatio) {
    case '1:1':
      return '1 / 1';
    case '3:4':
      return '3 / 4';
    case '4:3':
      return '4 / 3';
    case '9:16':
      return '9 / 16';
    case '16:9':
      return '16 / 9';
    case 'custom':
      return `1 / ${customHeight || 1.0}`;
    default:
      return '';
  }
};

// ==========================================
// Frame Theme Renderers
// ==========================================

/**
 * Applies the 'gallery' classic fine-art double mat wooden frame.
 */
const applyGalleryFrame = (
  wrapper: HTMLDivElement,
  imageToAppend: HTMLElement,
  scale: number,
  altText: string,
  isCropped: boolean
): void => {
  const frame = document.createElement('div');
  Object.assign(frame.style, {
    display: 'inline-flex',
    flexDirection: 'column',
    alignItems: 'center',
    backgroundColor: '#181818',
    border: '12px solid #111111',
    borderRadius: '2px',
    maxWidth: `${scale}%`,
    boxSizing: 'border-box',
    boxShadow: '0 25px 50px rgba(0, 0, 0, 0.65)',
  });

  const innerFrame = document.createElement('div');
  Object.assign(innerFrame.style, {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    backgroundColor: '#1f1f1f',
    borderStyle: 'solid',
    borderWidth: '5px',
    borderTopColor: '#2b2b2b',
    borderLeftColor: '#252525',
    borderRightColor: '#0a0a0a',
    borderBottomColor: '#080808',
    padding: '4px',
    boxSizing: 'border-box',
    width: '100%',
  });

  const hasCaption = isCustomCaption(altText);
  const mat = document.createElement('div');
  Object.assign(mat.style, {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    backgroundColor: '#f5f3eb',
    padding: hasCaption ? '24px 24px 0' : '24px',
    border: '1px solid #d8d4c7',
    boxShadow: 'inset 0 3px 8px rgba(0,0,0,0.06)',
    width: '100%',
    boxSizing: 'border-box',
  });

  const matWindow = document.createElement('div');
  Object.assign(matWindow.style, {
    display: 'block',
    backgroundColor: '#e6e3d8',
    padding: '3px',
    border: '1px solid #c2bdb0',
    boxShadow: 'inset 0 2px 4px rgba(0,0,0,0.1)',
    width: '100%',
    boxSizing: 'border-box',
  });

  imageToAppend.style.borderRadius = '0';
  imageToAppend.style.display = 'block';
  imageToAppend.style.width = '100%';
  imageToAppend.style.maxWidth = '100%';
  if (!isCropped) {
    imageToAppend.style.height = 'auto';
  }
  imageToAppend.style.border = '1px solid #a8a499';
  imageToAppend.style.boxShadow = '0 2px 4px rgba(0,0,0,0.15)';
  imageToAppend.style.boxSizing = 'border-box';

  wrapper.appendChild(frame);
  frame.appendChild(innerFrame);
  innerFrame.appendChild(mat);
  mat.appendChild(matWindow);
  matWindow.appendChild(imageToAppend);

  if (hasCaption) {
    const labelContainer = document.createElement('div');
    Object.assign(labelContainer.style, {
      display: 'flex',
      justifyContent: 'center',
      padding: '16px 0',
      width: '0',
      minWidth: '100%',
      boxSizing: 'border-box',
    });

    const label = document.createElement('div');
    Object.assign(label.style, {
      display: 'inline-flex',
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: '#ffffff',
      border: '1px solid #d9d9d9',
      borderRadius: '2px',
      padding: '5px 12px',
      boxShadow: '0 2px 5px rgba(0,0,0,0.05)',
      maxWidth: '90%',
      boxSizing: 'border-box',
    });

    const caption = document.createElement('span');
    Object.assign(caption.style, {
      fontSize: '11px',
      color: '#333333',
      fontFamily: '"Times New Roman", Times, "Georgia", serif',
      fontStyle: 'italic',
      letterSpacing: '0.04em',
      textAlign: 'center',
      overflow: 'hidden',
      whiteSpace: 'nowrap',
      textOverflow: 'ellipsis',
      flex: '1',
    });
    caption.textContent = altText;

    label.appendChild(caption);
    labelContainer.appendChild(label);
    mat.appendChild(labelContainer);
  }
};

/**
 * Applies the 'modern' white passe-partout frame with exhibit label.
 */
const applyModernFrame = (
  wrapper: HTMLDivElement,
  imageToAppend: HTMLElement,
  scale: number,
  altText: string,
  isCropped: boolean
): void => {
  const hasCaption = isCustomCaption(altText);
  const frame = document.createElement('div');
  Object.assign(frame.style, {
    display: 'inline-flex',
    flexDirection: 'column',
    alignItems: 'center',
    backgroundColor: '#ffffff',
    padding: hasCaption ? '24px 24px 16px' : '24px',
    border: '1px solid #e2e2e2',
    maxWidth: `${scale}%`,
    boxSizing: 'border-box',
    boxShadow: '0 12px 32px rgba(0,0,0,0.1), 0 2px 6px rgba(0,0,0,0.05), inset 0 0 0 1px #fcfcfc',
  });

  imageToAppend.style.borderRadius = '1px';
  imageToAppend.style.display = 'block';
  imageToAppend.style.width = '100%';
  imageToAppend.style.maxWidth = '100%';
  if (!isCropped) {
    imageToAppend.style.height = 'auto';
  }
  imageToAppend.style.boxShadow = '0 6px 18px rgba(0,0,0,0.12), 0 1px 4px rgba(0,0,0,0.08)';
  imageToAppend.style.border = '1px solid rgba(0,0,0,0.04)';
  imageToAppend.style.boxSizing = 'border-box';

  wrapper.appendChild(frame);
  frame.appendChild(imageToAppend);

  if (hasCaption) {
    const labelBlock = document.createElement('div');
    Object.assign(labelBlock.style, {
      marginTop: '16px',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      gap: '2px',
      width: '0',
      minWidth: '100%',
      boxSizing: 'border-box',
    });

    const divider = document.createElement('div');
    Object.assign(divider.style, {
      width: '24px',
      height: '1px',
      backgroundColor: '#e6e6e6',
      marginBottom: '6px',
    });

    const title = document.createElement('span');
    Object.assign(title.style, {
      fontSize: '10px',
      color: '#222222',
      fontFamily: 'system-ui, -apple-system, sans-serif',
      fontWeight: '600',
      letterSpacing: '0.12em',
      textAlign: 'center',
      overflow: 'hidden',
      whiteSpace: 'nowrap',
      textOverflow: 'ellipsis',
      width: '90%',
      boxSizing: 'border-box',
    });
    title.textContent = altText.toUpperCase();

    const subtitle = document.createElement('span');
    Object.assign(subtitle.style, {
      fontSize: '7.5px',
      color: '#999999',
      fontFamily: 'system-ui, -apple-system, sans-serif',
      letterSpacing: '0.08em',
      fontWeight: '500',
    });
    subtitle.textContent = 'EXHIBIT COLLECTION';

    labelBlock.appendChild(divider);
    labelBlock.appendChild(title);
    labelBlock.appendChild(subtitle);
    frame.appendChild(labelBlock);
  }
};

/**
 * Applies the 'tape' post-it memo frame with subtle rotation and washi tape.
 */
const applyTapeFrame = (
  wrapper: HTMLDivElement,
  imageToAppend: HTMLElement,
  scale: number,
  isCropped: boolean
): void => {
  const inner = document.createElement('div');
  const rotate = (Math.random() * 6 - 3).toFixed(1);
  Object.assign(inner.style, {
    display: 'inline-block',
    position: 'relative',
    backgroundColor: '#fffef0',
    padding: '14px 14px 10px',
    boxShadow: '0 4px 12px rgba(0,0,0,0.12), 0 1px 3px rgba(0,0,0,0.06)',
    transform: `rotate(${rotate}deg)`,
    maxWidth: `${scale}%`,
    boxSizing: 'border-box',
  });

  const tape = document.createElement('div');
  Object.assign(tape.style, {
    position: 'absolute',
    top: '-10px',
    left: '50%',
    transform: 'translateX(-50%) rotate(-2deg)',
    width: '72px',
    height: '24px',
    backgroundColor: 'rgba(180, 130, 200, 0.45)',
    borderLeft: '1px dashed rgba(255,255,255,0.4)',
    borderRight: '1px dashed rgba(255,255,255,0.4)',
  });
  inner.appendChild(tape);

  imageToAppend.style.borderRadius = '1px';
  imageToAppend.style.width = '100%';
  imageToAppend.style.maxWidth = '100%';
  if (!isCropped) {
    imageToAppend.style.height = 'auto';
  }
  imageToAppend.style.display = 'block';
  imageToAppend.style.boxSizing = 'border-box';

  wrapper.appendChild(inner);
  inner.appendChild(imageToAppend);
};

// ==========================================
// DOM Transformations
// ==========================================

/**
 * Processes and frames all image elements inside the cloned content.
 */
const processImages = (root: HTMLElement, options: MessageProcessorOptions): void => {
  const alignValue = options.imageAlign || 'left';
  const styleMode = options.imageStyle || 'none';
  const scale = options.imageScale && options.imageScale !== 100 ? options.imageScale : 100;
  const isCropped = Boolean(options.imageCropActive);

  root.querySelectorAll('img').forEach((el) => {
    const img = el as HTMLImageElement;
    const parent = img.parentNode;
    if (!parent) return;

    const wrapper = document.createElement('div');
    wrapper.className = 'log-exporter-image-wrapper';
    Object.assign(wrapper.style, {
      textAlign: alignValue,
      margin: '0.5em 0',
    });

    parent.insertBefore(wrapper, img);

    let imageToAppend: HTMLElement = img;

    if (isCropped) {
      const cropWrapper = document.createElement('div');
      const aspect = getAspectRatioCssValue(options.imageCropAspectRatio, options.imageCropHeight);

      Object.assign(cropWrapper.style, {
        display: 'block',
        width: '100%',
        overflow: 'hidden',
        position: 'relative',
        boxSizing: 'border-box',
      });
      if (aspect) {
        cropWrapper.style.aspectRatio = aspect;
      }

      const hPos = options.imageCropHAlign !== undefined ? options.imageCropHAlign : 50;
      const vPos = options.imageCropVAlign !== undefined ? options.imageCropVAlign : 50;

      img.style.setProperty('width', '100%', 'important');
      img.style.setProperty('height', '100%', 'important');
      img.style.setProperty('object-fit', 'cover', 'important');
      img.style.setProperty('object-position', `${hPos}% ${vPos}%`, 'important');
      img.style.setProperty('display', 'block', 'important');
      img.style.setProperty('max-width', '100%', 'important');

      cropWrapper.appendChild(img);
      imageToAppend = cropWrapper;
    } else {
      img.style.maxWidth = `${scale}%`;
      img.style.width = `${scale}%`;
      img.style.height = 'auto';
      img.style.display = 'inline-block';
      img.style.verticalAlign = 'middle';
    }

    switch (styleMode) {
      case 'gallery':
        applyGalleryFrame(wrapper, imageToAppend, scale, img.alt, isCropped);
        return;
      case 'modern':
        applyModernFrame(wrapper, imageToAppend, scale, img.alt, isCropped);
        return;
      case 'tape':
        applyTapeFrame(wrapper, imageToAppend, scale, isCropped);
        return;
      case 'none':
      default:
        break;
    }

    if (isCropped) {
      imageToAppend.style.maxWidth = `${scale}%`;
      imageToAppend.style.width = `${scale}%`;
      imageToAppend.style.display = 'inline-block';
      imageToAppend.style.verticalAlign = 'middle';
    }

    wrapper.appendChild(imageToAppend);
  });
};

/**
 * Scales HTML5 video elements based on user image scale settings.
 */
const processVideos = (root: HTMLElement, imageScale?: number): void => {
  if (!imageScale || imageScale === 100) return;

  root.querySelectorAll('video').forEach((el) => {
    const media = el as HTMLVideoElement;
    media.style.maxWidth = `${imageScale}%`;
    media.style.width = `${imageScale}%`;
    media.style.height = 'auto';
  });
};

/**
 * Helper to style a block element as a quote or thought box.
 */
const styleCustomBlock = (
  el: Element,
  bg: string | undefined,
  textColor: string | undefined,
  border: string | null = null
): void => {
  const newBlock = document.createElement('div');
  newBlock.innerHTML = `<div style="padding:0; margin:0;">${el.innerHTML}</div>`;
  Object.assign(newBlock.style, {
    padding: '0.75em 1em',
    margin: '0.75em 0',
    borderRadius: '4px',
    borderLeft: `3px solid ${border || 'transparent'}`,
    backgroundColor: bg || '',
    color: textColor || '',
  });
  el.replaceWith(newBlock);
};

/**
 * Applies custom theme colors to quote blocks, thought blocks, and inline quote marks.
 */
const processFormattedBlocks = (root: HTMLElement, color: ColorPalette): void => {
  root
    .querySelectorAll('.x-risu-regex-quote-block')
    .forEach((el) => styleCustomBlock(el, color.quoteBg, color.quoteText, color.quoteText || null));

  root
    .querySelectorAll('.x-risu-regex-thought-block')
    .forEach((el) => styleCustomBlock(el, color.thoughtBg, color.thoughtText));

  root.querySelectorAll('mark[risu-mark^="quote"]').forEach((markEl) => {
    const mark = markEl as HTMLElement;
    Object.assign(mark.style, {
      backgroundColor: color.quoteBg || '',
      color: color.quoteText || '',
      padding: '0.1em 0.3em',
      borderRadius: '3px',
      textDecoration: 'none',
    });
  });
};

// ==========================================
// Pipeline Runners
// ==========================================

/**
 * Processes raw HTML message content (preserves original DOM structure while embedding images and applying replacements).
 */
const processRawHtmlContent = async (
  originalMessageEl: Element,
  embedImages: boolean,
  replacementRules?: ReplacementRule[]
): Promise<string> => {
  const clonedContentEl = originalMessageEl.cloneNode(true) as HTMLElement;
  clonedContentEl.querySelectorAll('button, .log-exporter-msg-btn-group').forEach((btn) => btn.remove());

  await embedImagesInElement(clonedContentEl, embedImages, keepBackgroundImage);
  applyReplacements(clonedContentEl, replacementRules);

  return clonedContentEl.outerHTML.trim();
};

/**
 * Standard processing pipeline applying image embedding, framing, scaling, styling, and text replacements.
 */
const processMessageContent = async (
  options: FullMessageProcessingOptions
): Promise<string> => {
  const { originalMessageEl, embedImages, color, replacementRules } = options;

  const contentSourceEl = originalMessageEl.cloneNode(true) as HTMLElement;
  contentSourceEl.querySelectorAll('script, style, .log-exporter-msg-btn-group').forEach((el) => el.remove());

  await embedImagesInElement(contentSourceEl, embedImages, replaceBackgroundWithImg);

  processImages(contentSourceEl, options);
  processVideos(contentSourceEl, options.imageScale);
  processFormattedBlocks(contentSourceEl, color);
  applyReplacements(contentSourceEl, replacementRules);

  return contentSourceEl.innerHTML.trim();
};

// ==========================================
// Main Hook Export
// ==========================================

/**
 * React hook to process chat message HTML content asynchronously with image embedding,
 * frame styling, cropping, and regex text replacements.
 */
export const useMessageProcessor = (
  originalMessageEl: Element | null,
  embedImagesAsBlob: boolean,
  allowHtmlRendering: boolean,
  color: ColorPalette,
  imageScale?: number,
  onComplete?: () => void,
  replacementRules?: ReplacementRule[],
  imageAlign?: 'left' | 'center' | 'right',
  imageStyle?: ImageStyle,
  imageCropActive?: boolean,
  imageCropAspectRatio?: string,
  imageCropVAlign?: number,
  imageCropHAlign?: number,
  imageCropHeight?: number
): string => {
  const isSync = canProcessSynchronously(originalMessageEl, replacementRules);

  const [processedContent, setProcessedContent] = useState<string>(() => {
    if (!originalMessageEl) return '';
    if (isSync) {
      return originalMessageEl.innerHTML.trim();
    }
    return '';
  });

  const onCompleteRef = useRef(onComplete);
  useEffect(() => {
    onCompleteRef.current = onComplete;
  }, [onComplete]);

  useEffect(() => {
    if (!originalMessageEl) {
      setProcessedContent('');
      return;
    }

    if (isSync) {
      const syncContent = originalMessageEl.innerHTML.trim();
      setProcessedContent((prev) => (prev !== syncContent ? syncContent : prev));
      onCompleteRef.current?.();
      return;
    }

    let isCancelled = false;

    const process = async () => {
      let result = '';
      if (allowHtmlRendering) {
        result = await processRawHtmlContent(
          originalMessageEl,
          embedImagesAsBlob,
          replacementRules
        );
      } else {
        result = await processMessageContent({
          originalMessageEl,
          embedImages: embedImagesAsBlob,
          color,
          imageScale,
          replacementRules,
          imageAlign,
          imageStyle,
          imageCropActive,
          imageCropAspectRatio,
          imageCropVAlign,
          imageCropHAlign,
          imageCropHeight,
        });
      }

      if (!isCancelled) {
        setProcessedContent(result);
        onCompleteRef.current?.();
      }
    };

    void process();

    return () => {
      isCancelled = true;
    };
  }, [
    originalMessageEl,
    isSync,
    allowHtmlRendering,
    embedImagesAsBlob,
    color,
    imageScale,
    replacementRules,
    imageAlign,
    imageStyle,
    imageCropActive,
    imageCropAspectRatio,
    imageCropVAlign,
    imageCropHAlign,
    imageCropHeight,
  ]);

  return processedContent;
};
