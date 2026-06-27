import { useState, useEffect } from 'react';
import { imageUrlToBlob } from '../utils/imageUtils';
import { applyReplacements } from '../utils/domUtils';
import { showWarning } from '../utils/notify';
import type { ColorPalette, ReplacementRule, ImageStyle } from '../../types';

export const useMessageProcessor = (
  originalMessageEl: Element | null,
  embedImagesAsBlob: boolean,
  allowHtmlRendering: boolean,
  color: ColorPalette,
  imageScale?: number,
  onComplete?: () => void,
  replacementRules?: ReplacementRule[],
  imageAlign?: 'left' | 'center' | 'right',
  imageStyle?: ImageStyle
) => {
  const [processedContent, setProcessedContent] = useState('');

  useEffect(() => {
    if (!originalMessageEl) return;

    const process = async () => {
      if (allowHtmlRendering) {
        setProcessedContent(await processRawHtmlContent(originalMessageEl, embedImagesAsBlob, replacementRules));
      } else {
        setProcessedContent(await processMessageContent(originalMessageEl, embedImagesAsBlob, color, imageScale, replacementRules, imageAlign, imageStyle));
      }
      if (onComplete) {
        onComplete();
      }
    };

    process();
  }, [originalMessageEl, embedImagesAsBlob, allowHtmlRendering, color, imageScale, onComplete, replacementRules, imageAlign, imageStyle]);

  return processedContent;
};

const processRawHtmlContent = async (originalMessageEl: Element, embedImages: boolean, replacementRules?: ReplacementRule[]): Promise<string> => {
    const clonedContentEl = originalMessageEl.cloneNode(true) as HTMLElement;
    clonedContentEl.querySelectorAll('button, .log-exporter-msg-btn-group').forEach(btn => btn.remove());

    const mediaPromises = Array.from(clonedContentEl.querySelectorAll('img, [style*="background-image"]')).map(async (el) => {
        const element = el as HTMLElement;
        if (element.tagName === 'IMG') {
            const img = element as HTMLImageElement;
            if (img.src && embedImages && !img.src.startsWith('data:') && !img.src.startsWith('blob:')) {
                try {
                    img.src = await imageUrlToBlob(img.src);
                } catch (e) {
                    console.error('[log plugin] Failed to embed image as blob:', img.src, e);
                    showWarning(`이미지 임베딩 실패: ${img.src.substring(0, 80)}${img.src.length > 80 ? '...' : ''}`);
                }
            }
        } else {
            const style = element.getAttribute('style');
            const urlMatch = style?.match(/url\(["'"]?(.+?)["'"]?\)/);
            if (urlMatch?.[1] && embedImages && !urlMatch[1].startsWith('data:') && !urlMatch[1].startsWith('blob:')) {
                try {
                    const convertedUrl = await imageUrlToBlob(urlMatch[1]);
                    element.style.backgroundImage = `url("${convertedUrl}")`;
                } catch (e) {
                    console.error('[log plugin] Failed to embed background image as blob:', urlMatch[1], e);
                    showWarning(`배경 이미지 임베딩 실패: ${urlMatch[1].substring(0, 80)}${urlMatch[1].length > 80 ? '...' : ''}`);
                }
            }
        }
    });

    await Promise.all(mediaPromises);

    applyReplacements(clonedContentEl, replacementRules);

    return clonedContentEl.outerHTML.trim();
};

const processMessageContent = async (originalMessageEl: Element, embedImages: boolean, color: ColorPalette, imageScale?: number, replacementRules?: ReplacementRule[], imageAlign?: 'left' | 'center' | 'right', imageStyle?: ImageStyle): Promise<string> => {
    const contentSourceEl = originalMessageEl.cloneNode(true) as HTMLElement;
    contentSourceEl.querySelectorAll('script, style, .log-exporter-msg-btn-group').forEach(el => el.remove());

    const mediaPromises = Array.from(contentSourceEl.querySelectorAll('img, [style*="background-image"]')).map(async (el) => {
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
            const urlMatch = style?.match(/url\(["'"]?(.+?)["'"]?\)/);
            if (urlMatch?.[1]) {
                const img = document.createElement('img');
                img.src = embedImages ? await imageUrlToBlob(urlMatch[1]) : urlMatch[1];
                el.parentNode?.insertBefore(img, el);
                el.remove();
            }
        }
    });
    await Promise.all(mediaPromises);

    // 이미지 스케일, 정렬 및 스타일 적용
    // none:      스타일 없음
    // gallery:   클래식 액자 — 금색 프레임 + 매트 + 하단 캡션바
    // modern:    현대 액자 — 얇은 프레임 + 넓은 여백 + 부드러운 그림자
    // tape:      포스트잇 메모 — 크림 배경 + 와시 테이프 + 미세 회전
    const alignValue = imageAlign || 'left';
    const styleMode = imageStyle || 'none';
    contentSourceEl.querySelectorAll('img').forEach(el => {
        const img = el as HTMLImageElement;
        const scale = imageScale && imageScale !== 100 ? imageScale : 100;
        const parent = img.parentNode;
        if (!parent) return;

        const wrapper = document.createElement('div');
        wrapper.className = 'log-exporter-image-wrapper';
        Object.assign(wrapper.style, {
            textAlign: alignValue,
            margin: '0.5em 0',
        });

        img.style.maxWidth = `${scale}%`;
        img.style.width = `${scale}%`;
        img.style.height = 'auto';
        img.style.display = 'inline-block';
        img.style.verticalAlign = 'middle';

        switch (styleMode) {
            case 'gallery': {
                // 클래식 액자: 이중 프레임(외곽 갈색 금색 + 내곽 매트) + 하단 캡션바
                const frame = document.createElement('div');
                Object.assign(frame.style, {
                    display: 'inline-block',
                    backgroundColor: '#8b6914',
                    padding: '4px',
                    boxShadow: '0 6px 20px rgba(0,0,0,0.3), inset 0 0 0 1px rgba(255,215,0,0.3)',
                    background: 'linear-gradient(135deg, #a67c1e 0%, #8b6914 50%, #6b4f0f 100%)',
                });
                const mat = document.createElement('div');
                Object.assign(mat.style, {
                    backgroundColor: '#f5f0e6',
                    padding: '14px 18px 0',
                });
                img.style.borderRadius = '0';
                img.style.display = 'block';
                // 캡션바
                const caption = document.createElement('div');
                Object.assign(caption.style, {
                    padding: '10px 18px 12px',
                    fontSize: '0.75em',
                    color: '#5c4a1e',
                    fontStyle: 'italic',
                    textAlign: 'center',
                    textOverflow: 'ellipsis',
                    overflow: 'hidden',
                    whiteSpace: 'nowrap',
                });
                caption.textContent = img.alt || '';
                parent.insertBefore(wrapper, img);
                wrapper.appendChild(frame);
                frame.appendChild(mat);
                mat.appendChild(img);
                mat.appendChild(caption);
                return;
            }
            case 'modern': {
                // 현대 액자: 얇은 프레임 + 넓은 여백 + 부드러운 그림자
                const frame = document.createElement('div');
                Object.assign(frame.style, {
                    display: 'inline-block',
                    backgroundColor: '#fff',
                    padding: '20px 24px 16px',
                    boxShadow: '0 12px 40px rgba(0,0,0,0.15), 0 2px 6px rgba(0,0,0,0.06)',
                    border: '1px solid rgba(0,0,0,0.08)',
                });
                img.style.borderRadius = '0';
                img.style.display = 'block';
                parent.insertBefore(wrapper, img);
                wrapper.appendChild(frame);
                frame.appendChild(img);
                return;
            }
            case 'tape': {
                // 포스트잇 메모: 크림 배경 + 와시 테이프 + 미세 회전
                const inner = document.createElement('div');
                const rotate = (Math.random() * 6 - 3).toFixed(1);
                Object.assign(inner.style, {
                    display: 'inline-block',
                    position: 'relative',
                    backgroundColor: '#fffef0',
                    padding: '14px 14px 10px',
                    boxShadow: '0 2px 8px rgba(0,0,0,0.18)',
                    transform: `rotate(${rotate}deg)`,
                });
                // 와시 테이프 (상단)
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
                img.style.borderRadius = '1px';
                parent.insertBefore(wrapper, img);
                wrapper.appendChild(inner);
                inner.appendChild(img);
                return;
            }
            case 'none':
            default:
                break;
        }

        parent.insertBefore(wrapper, img);
        wrapper.appendChild(img);
    });

    // 비디오도 스케일 적용
    if (imageScale && imageScale !== 100) {
        contentSourceEl.querySelectorAll('video').forEach(el => {
            const media = el as HTMLVideoElement;
            media.style.maxWidth = `${imageScale}%`;
            media.style.width = `${imageScale}%`;
            media.style.height = 'auto';
        });
    }

    const styleBlock = (el: Element, bg: string | undefined, textColor: string | undefined, border: string | null = null) => {
        const newBlock = document.createElement('div');
        newBlock.innerHTML = `<div style="padding:0; margin:0;">${el.innerHTML}</div>`;
        Object.assign(newBlock.style, { padding: '0.75em 1em', margin: '0.75em 0', borderRadius: '4px', borderLeft: `3px solid ${border || 'transparent'}`, backgroundColor: bg, color: textColor });
        el.replaceWith(newBlock);
    };

    contentSourceEl.querySelectorAll('.x-risu-regex-quote-block').forEach(el => styleBlock(el, color.quoteBg, color.quoteText, color.quoteText));
    contentSourceEl.querySelectorAll('.x-risu-regex-thought-block').forEach(el => styleBlock(el, color.thoughtBg, color.thoughtText));

    contentSourceEl.querySelectorAll('mark[risu-mark^="quote"]').forEach(markEl => {
        const mark = markEl as HTMLElement;
        Object.assign(mark.style, { backgroundColor: color.quoteBg, color: color.quoteText, padding: '0.1em 0.3em', borderRadius: '3px', textDecoration: 'none' });
    });

    applyReplacements(contentSourceEl, replacementRules);

    return contentSourceEl.innerHTML.trim();
};
