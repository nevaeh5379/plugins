import { useState, useEffect, useRef } from 'react';
import { imageUrlToBlob, extractBackgroundImageUrl } from '../utils/imageUtils';
import { applyReplacements } from '../utils/domUtils';
import { showWarning } from '../utils/notify';
import type { ColorPalette, ReplacementRule, ImageStyle } from '../../types';

// ──────────────────────────────────────────────
// Helper: 동기 처리 가능 여부 판별
// ──────────────────────────────────────────────

const canProcessSynchronously = (
  originalMessageEl: Element | null,
  replacementRules?: ReplacementRule[]
): boolean => {
  if (!originalMessageEl) return true;
  if (replacementRules && replacementRules.length > 0) return false;

  const hasSpecialElements = originalMessageEl.querySelector(
    'img, video, [style*="background-image"], button, .log-exporter-msg-btn-group, .x-risu-regex-quote-block, .x-risu-regex-thought-block, mark[risu-mark^="quote"]'
  );
  return !hasSpecialElements;
};

// ──────────────────────────────────────────────
// 커스텀 캡션 판별
// ──────────────────────────────────────────────

const isCustomCaption = (alt: string | null | undefined): boolean => {
  if (!alt) return false;
  const trimmed = alt.trim();
  if (!trimmed) return false;
  const lower = trimmed.toLowerCase();

  const placeholders = [
    'character portrait', 'character-portrait', 'image', 'avatar',
    'user portrait', 'user-portrait', 'attachment', 'file', 'portrait',
  ];
  if (placeholders.includes(lower)) return false;
  if (lower.startsWith('/sw/') || lower.includes('/') || lower.includes('\\')) return false;
  if (lower.startsWith('http://') || lower.startsWith('https://')) return false;
  if (lower.startsWith('data:') || lower.startsWith('blob:')) return false;
  if (/\.(png|jpe?g|webp|gif|bmp)$/i.test(lower)) return false;
  if (/^[a-f0-9\-_]+$/i.test(lower) && lower.length > 8) return false;

  return true;
};

// ──────────────────────────────────────────────
// 배경 이미지 핸들러 타입
// ──────────────────────────────────────────────

type BgHandler = (element: HTMLElement, bgUrl: string, embedImages: boolean) => Promise<void>;

// ──────────────────────────────────────────────
// 이미지 임베딩 (img + background-image)
// ──────────────────────────────────────────────

const embedImagesInElement = async (
    element: HTMLElement,
    embedImages: boolean,
    onBackgroundImage: BgHandler
): Promise<void> => {
    const mediaPromises = Array.from(element.querySelectorAll('img, [style*="background-image"]')).map(async (el) => {
        if (el.tagName === 'IMG') {
            const img = el as HTMLImageElement;
            if (img.src && embedImages && !img.src.startsWith('data:') && !img.src.startsWith('blob:')) {
                try {
                    img.src = await imageUrlToBlob(img.src);
                } catch (e) {
                    console.error('[log plugin] Failed to embed image as blob:', img.src, e);
                    showWarning(`이미지 임베딩 실패: ${img.src.substring(0, 80)}${img.src.length > 80 ? '...' : ''}`);
                }
            }
        } else {
            const style = el.getAttribute('style');
            const bgUrl = style ? extractBackgroundImageUrl(style) : null;
            if (bgUrl) {
                await onBackgroundImage(el as HTMLElement, bgUrl, embedImages);
            }
        }
    });
    await Promise.all(mediaPromises);
};

const keepBackgroundImage: BgHandler = async (element, bgUrl, embedImages) => {
    if (embedImages && !bgUrl.startsWith('data:') && !bgUrl.startsWith('blob:')) {
        try {
            const convertedUrl = await imageUrlToBlob(bgUrl);
            element.style.backgroundImage = `url("${convertedUrl}")`;
        } catch (e) {
            console.error('[log plugin] Failed to embed background image as blob:', bgUrl, e);
            showWarning(`배경 이미지 임베딩 실패: ${bgUrl.substring(0, 80)}${bgUrl.length > 80 ? '...' : ''}`);
        }
    }
};

const replaceBackgroundWithImg: BgHandler = async (element, bgUrl, embedImages) => {
    const img = document.createElement('img');
    img.src = embedImages ? await imageUrlToBlob(bgUrl) : bgUrl;
    element.parentNode?.insertBefore(img, element);
    element.remove();
};

// ──────────────────────────────────────────────
// Raw HTML 처리 (버튼 제거 + 이미지 임베딩 + 대체)
// ──────────────────────────────────────────────

const processRawHtmlContent = async (originalMessageEl: Element, embedImages: boolean, replacementRules?: ReplacementRule[]): Promise<string> => {
    const clonedContentEl = originalMessageEl.cloneNode(true) as HTMLElement;
    clonedContentEl.querySelectorAll('button, .log-exporter-msg-btn-group').forEach(btn => btn.remove());
    await embedImagesInElement(clonedContentEl, embedImages, keepBackgroundImage);
    applyReplacements(clonedContentEl, replacementRules);
    return clonedContentEl.outerHTML.trim();
};

// ──────────────────────────────────────────────
// processMessageContent — 전체 파이프라인 (orchestrator)
// 각 단계가 별도 함수로 분리됨
// ──────────────────────────────────────────────

const processMessageContent = async (
    originalMessageEl: Element,
    embedImages: boolean,
    color: ColorPalette,
    imageScale?: number,
    replacementRules?: ReplacementRule[],
    imageAlign?: 'left' | 'center' | 'right',
    imageStyle?: ImageStyle,
    imageCropActive?: boolean,
    imageCropAspectRatio?: string,
    imageCropVAlign?: number,
    imageCropHAlign?: number,
    imageCropHeight?: number
): Promise<string> => {
    // 1. DOM 클린업 (script, style, 버튼 제거)
    const contentSourceEl = cleanMessageElement(originalMessageEl);

    // 2. 이미지 임베딩 (img + background-image → blob URL)
    await embedImagesInElement(contentSourceEl, embedImages, replaceBackgroundWithImg);

    // 3. 이미지 처리 (스케일, 크롭, 테마 프레임)
    applyImageProcessing(contentSourceEl, {
        scale: imageScale,
        align: imageAlign,
        style: imageStyle,
        cropActive: imageCropActive,
        cropAspectRatio: imageCropAspectRatio,
        cropVAlign: imageCropVAlign,
        cropHAlign: imageCropHAlign,
        cropHeight: imageCropHeight,
    });

    // 4. 비디오 스케일
    applyVideoSizing(contentSourceEl, imageScale);

    // 5. 레귤러 블록 스타일링 (인용구, 사고, 따옴표)
    styleRegexBlocks(contentSourceEl, color);

    // 6. 대체 텍스트 적용
    applyReplacements(contentSourceEl, replacementRules);

    return contentSourceEl.innerHTML.trim();
};

// ──────────────────────────────────────────────
// 역할 1: DOM 클린업
// ──────────────────────────────────────────────

const cleanMessageElement = (originalMessageEl: Element): HTMLElement => {
    const cloned = originalMessageEl.cloneNode(true) as HTMLElement;
    cloned.querySelectorAll('script, style, .log-exporter-msg-btn-group').forEach(el => el.remove());
    return cloned;
};

// ──────────────────────────────────────────────
// 역할 2: 이미지 스케일 / 크롭 / 테마 프레임
// ──────────────────────────────────────────────

interface ImageProcessingOptions {
    scale?: number;
    align?: 'left' | 'center' | 'right';
    style?: ImageStyle;
    cropActive?: boolean;
    cropAspectRatio?: string;
    cropVAlign?: number;
    cropHAlign?: number;
    cropHeight?: number;
}

const applyImageProcessing = (
    contentSourceEl: HTMLElement,
    opts: ImageProcessingOptions
): void => {
    const alignValue = opts.align || 'left';
    const styleMode = opts.style || 'none';
    const scale = opts.scale && opts.scale !== 100 ? opts.scale : 100;

    contentSourceEl.querySelectorAll('img').forEach(el => {
        const img = el as HTMLImageElement;
        const parent = img.parentNode;
        if (!parent) return;

        const wrapper = createImageWrapper(alignValue);
        parent.insertBefore(wrapper, img);

        const croppedImage = buildCroppedImage(img, opts);
        const framedContent = applyFrameStyle(croppedImage, img, styleMode, scale, opts.cropActive);
        wrapper.appendChild(framedContent);
    });
};

const createImageWrapper = (textAlign: string): HTMLDivElement => {
    const wrapper = document.createElement('div');
    wrapper.className = 'log-exporter-image-wrapper';
    Object.assign(wrapper.style, {
        textAlign,
        margin: '0.5em 0',
    });
    return wrapper;
};

const buildCroppedImage = (
    img: HTMLImageElement,
    opts: ImageProcessingOptions
): HTMLElement => {
    if (opts.cropActive) {
        return createCropWrapper(img, opts);
    }
    // 크롭 미적용 — 표준 스케일 스타일
    img.style.maxWidth = `${opts.scale || 100}%`;
    img.style.width = `${opts.scale || 100}%`;
    img.style.height = 'auto';
    img.style.display = 'inline-block';
    img.style.verticalAlign = 'middle';
    return img;
};

const createCropWrapper = (
    img: HTMLImageElement,
    opts: ImageProcessingOptions
): HTMLDivElement => {
    const cropWrapper = document.createElement('div');
    const aspect = resolveAspectRatio(opts.cropAspectRatio, opts.cropHeight);

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

    applyCropImageStyles(img, opts);
    cropWrapper.appendChild(img);
    return cropWrapper;
};

const resolveAspectRatio = (aspectRatio?: string, customHeight?: number): string | undefined => {
    switch (aspectRatio) {
        case '1:1': return '1 / 1';
        case '3:4': return '3 / 4';
        case '4:3': return '4 / 3';
        case '9:16': return '9 / 16';
        case '16:9': return '16 / 9';
        case 'custom': return customHeight ? `1 / ${customHeight}` : undefined;
        default: return undefined;
    }
};

const applyCropImageStyles = (
    img: HTMLImageElement,
    opts: ImageProcessingOptions
): void => {
    console.log('[log plugin] Setting img objectPosition to:',
        `${opts.cropHAlign !== undefined ? opts.cropHAlign : 50}% ${opts.cropVAlign !== undefined ? opts.cropVAlign : 50}%`);
    img.style.setProperty('width', '100%', 'important');
    img.style.setProperty('height', '100%', 'important');
    img.style.setProperty('object-fit', 'cover', 'important');
    img.style.setProperty('object-position',
        `${opts.cropHAlign !== undefined ? opts.cropHAlign : 50}% ${opts.cropVAlign !== undefined ? opts.cropVAlign : 50}%`, 'important');
    img.style.setProperty('display', 'block', 'important');
    img.style.setProperty('max-width', '100%', 'important');
};

const applyFrameStyle = (
    imageToAppend: HTMLElement,
    img: HTMLImageElement,
    styleMode: ImageStyle,
    scale: number,
    cropActive?: boolean
): HTMLElement => {
    switch (styleMode) {
        case 'gallery': return buildGalleryFrame(imageToAppend, img, scale, cropActive);
        case 'modern': return buildModernFrame(imageToAppend, img, scale, cropActive);
        case 'tape': return buildTapeFrame(imageToAppend, scale);
        case 'none':
        default: return imageToAppend;
    }
};

// ──────────────────────────────────────────────
// 역할 3a: Gallery 프레임
// ──────────────────────────────────────────────

const buildGalleryFrame = (
    imageToAppend: HTMLElement,
    img: HTMLImageElement,
    scale: number,
    cropActive?: boolean
): HTMLDivElement => {
    const frame = createGalleryOuterFrame(scale);
    const innerFrame = createGalleryInnerFrame();
    const hasCaption = isCustomCaption(img.alt);
    const mat = createGalleryMat(hasCaption);
    const matWindow = createGalleryMatWindow();

    applyFrameImageStyles(imageToAppend, cropActive);

    frame.appendChild(innerFrame);
    innerFrame.appendChild(mat);
    mat.appendChild(matWindow);
    matWindow.appendChild(imageToAppend);

    if (hasCaption) {
        mat.appendChild(createGalleryCaption(img.alt));
    }

    return frame;
};

const createGalleryOuterFrame = (scale: number): HTMLDivElement => {
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
    return frame;
};

const createGalleryInnerFrame = (): HTMLDivElement => {
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
    return innerFrame;
};

const createGalleryMat = (hasCaption: boolean): HTMLDivElement => {
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
    return mat;
};

const createGalleryMatWindow = (): HTMLDivElement => {
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
    return matWindow;
};

const applyFrameImageStyles = (imageToAppend: HTMLElement, cropActive?: boolean): void => {
    imageToAppend.style.borderRadius = '0';
    imageToAppend.style.display = 'block';
    imageToAppend.style.width = '100%';
    imageToAppend.style.maxWidth = '100%';
    if (!cropActive) {
        imageToAppend.style.height = 'auto';
    }
    imageToAppend.style.border = '1px solid #a8a499';
    imageToAppend.style.boxShadow = '0 2px 4px rgba(0,0,0,0.15)';
    imageToAppend.style.boxSizing = 'border-box';
};

const createGalleryCaption = (alt: string): HTMLDivElement => {
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
    caption.textContent = alt;

    label.appendChild(caption);
    labelContainer.appendChild(label);
    return labelContainer;
};

// ──────────────────────────────────────────────
// 역할 3b: Modern 프레임
// ──────────────────────────────────────────────

const buildModernFrame = (
    imageToAppend: HTMLElement,
    img: HTMLImageElement,
    scale: number,
    cropActive?: boolean
): HTMLDivElement => {
    const hasCaption = isCustomCaption(img.alt);
    const frame = createModernFrameContainer(hasCaption, scale);
    applyModernImageStyles(imageToAppend, cropActive);

    frame.appendChild(imageToAppend);

    if (hasCaption) {
        frame.appendChild(createModernCaption(img.alt));
    }

    return frame;
};

const createModernFrameContainer = (hasCaption: boolean, scale: number): HTMLDivElement => {
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
    return frame;
};

const applyModernImageStyles = (imageToAppend: HTMLElement, cropActive?: boolean): void => {
    imageToAppend.style.borderRadius = '1px';
    imageToAppend.style.display = 'block';
    imageToAppend.style.width = '100%';
    imageToAppend.style.maxWidth = '100%';
    if (!cropActive) {
        imageToAppend.style.height = 'auto';
    }
    imageToAppend.style.boxShadow = '0 6px 18px rgba(0,0,0,0.12), 0 1px 4px rgba(0,0,0,0.08)';
    imageToAppend.style.border = '1px solid rgba(0,0,0,0.04)';
    imageToAppend.style.boxSizing = 'border-box';
};

const createModernCaption = (alt: string): HTMLDivElement => {
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
    title.textContent = alt.toUpperCase();

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
    return labelBlock;
};

// ──────────────────────────────────────────────
// 역할 3c: Tape (포스트잇) 프레임
// ──────────────────────────────────────────────

const buildTapeFrame = (
    imageToAppend: HTMLElement,
    scale: number
): HTMLDivElement => {
    const inner = createTapeInner(scale);
    inner.appendChild(createWashiTape());
    applyTapeImageStyles(imageToAppend);
    inner.appendChild(imageToAppend);
    return inner;
};

const createTapeInner = (scale: number): HTMLDivElement => {
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
    return inner;
};

const createWashiTape = (): HTMLDivElement => {
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
    return tape;
};

const applyTapeImageStyles = (imageToAppend: HTMLElement): void => {
    imageToAppend.style.borderRadius = '1px';
    imageToAppend.style.width = '100%';
    imageToAppend.style.maxWidth = '100%';
    imageToAppend.style.display = 'block';
    imageToAppend.style.boxSizing = 'border-box';
};

// ──────────────────────────────────────────────
// 역할 4: 비디오 스케일
// ──────────────────────────────────────────────

const applyVideoSizing = (contentSourceEl: HTMLElement, imageScale?: number): void => {
    if (!imageScale || imageScale === 100) return;
    contentSourceEl.querySelectorAll('video').forEach(el => {
        const media = el as HTMLVideoElement;
        media.style.maxWidth = `${imageScale}%`;
        media.style.width = `${imageScale}%`;
        media.style.height = 'auto';
    });
};

// ──────────────────────────────────────────────
// 역할 5: 레귤러 블록 스타일링
// ──────────────────────────────────────────────

const styleRegexBlocks = (contentSourceEl: HTMLElement, color: ColorPalette): void => {
    const styleBlock = (el: Element, bg: string | undefined, textColor: string | undefined, border: string | null = null) => {
        const newBlock = document.createElement('div');
        newBlock.innerHTML = `<div style="padding:0; margin:0;">${el.innerHTML}</div>`;
        Object.assign(newBlock.style, {
            padding: '0.75em 1em',
            margin: '0.75em 0',
            borderRadius: '4px',
            borderLeft: `3px solid ${border || 'transparent'}`,
            backgroundColor: bg,
            color: textColor,
        });
        el.replaceWith(newBlock);
    };

    contentSourceEl.querySelectorAll('.x-risu-regex-quote-block')
        .forEach(el => styleBlock(el, color.quoteBg, color.quoteText, color.quoteText));
    contentSourceEl.querySelectorAll('.x-risu-regex-thought-block')
        .forEach(el => styleBlock(el, color.thoughtBg, color.thoughtText));
    contentSourceEl.querySelectorAll<HTMLElement>('mark[risu-mark^="quote"]')
        .forEach(markEl => {
            Object.assign(markEl.style, {
                backgroundColor: color.quoteBg,
                color: color.quoteText,
                padding: '0.1em 0.3em',
                borderRadius: '3px',
                textDecoration: 'none',
            });
        });
};

// ──────────────────────────────────────────────
// React Hook: useMessageProcessor
// ──────────────────────────────────────────────

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
) => {
  const isSync = canProcessSynchronously(originalMessageEl, replacementRules);
  const getInitialContent = () => {
    if (!originalMessageEl) return '';
    if (isSync) {
      return originalMessageEl.innerHTML.trim();
    }
    return '';
  };

  const [processedContent, setProcessedContent] = useState(getInitialContent);
  const onCompleteRef = useRef(onComplete);

  useEffect(() => {
    onCompleteRef.current = onComplete;
  }, [onComplete]);

  const depsKey = JSON.stringify({
    embedImagesAsBlob,
    allowHtmlRendering,
    color,
    imageScale,
    replacementRules,
    imageAlign,
    imageStyle,
    imageCropActive,
    imageCropAspectRatio,
    imageCropVAlign,
    imageCropHAlign,
    imageCropHeight
  });

  useEffect(() => {
    if (!originalMessageEl) {
      if (onCompleteRef.current) onCompleteRef.current();
      return;
    }

    if (isSync) {
      const syncContent = originalMessageEl.innerHTML.trim();
      if (processedContent !== syncContent) {
        setProcessedContent(syncContent);
      }
      if (onCompleteRef.current) onCompleteRef.current();
      return;
    }

    const process = async () => {
      try {
        console.log('[log plugin] useMessageProcessor hook process():', {
          imageCropActive,
          imageCropAspectRatio,
          imageCropVAlign,
          imageCropHAlign,
          imageCropHeight
        });
        let result = '';
        if (allowHtmlRendering) {
          result = await processRawHtmlContent(originalMessageEl, embedImagesAsBlob, replacementRules);
        } else {
          result = await processMessageContent(originalMessageEl, embedImagesAsBlob, color, imageScale, replacementRules, imageAlign, imageStyle, imageCropActive, imageCropAspectRatio, imageCropVAlign, imageCropHAlign, imageCropHeight);
        }
        setProcessedContent(result);
      } catch (error) {
        console.error('[log plugin] Error processing message content:', error);
      } finally {
        if (onCompleteRef.current) {
          onCompleteRef.current();
        }
      }
    };

    process();
  }, [originalMessageEl, depsKey, isSync, allowHtmlRendering, color, embedImagesAsBlob, imageAlign, imageCropActive, imageCropAspectRatio, imageCropHAlign, imageCropHeight, imageCropVAlign, imageScale, imageStyle, processedContent, replacementRules]);

  return processedContent;
};
