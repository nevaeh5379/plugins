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
  imageStyle?: ImageStyle,
  imageCropActive?: boolean,
  imageCropAspectRatio?: string,
  imageCropVAlign?: number,
  imageCropHAlign?: number,
  imageCropHeight?: number
) => {
  const [processedContent, setProcessedContent] = useState('');

  useEffect(() => {
    if (!originalMessageEl) return;

    const process = async () => {
      console.log('[log plugin] useMessageProcessor hook process():', {
        imageCropActive,
        imageCropAspectRatio,
        imageCropVAlign,
        imageCropHAlign,
        imageCropHeight
      });
      if (allowHtmlRendering) {
        setProcessedContent(await processRawHtmlContent(originalMessageEl, embedImagesAsBlob, replacementRules));
      } else {
        setProcessedContent(await processMessageContent(originalMessageEl, embedImagesAsBlob, color, imageScale, replacementRules, imageAlign, imageStyle, imageCropActive, imageCropAspectRatio, imageCropVAlign, imageCropHAlign, imageCropHeight));
      }
      if (onComplete) {
        onComplete();
      }
    };

    process();
  }, [originalMessageEl, embedImagesAsBlob, allowHtmlRendering, color, imageScale, onComplete, replacementRules, imageAlign, imageStyle, imageCropActive, imageCropAspectRatio, imageCropVAlign, imageCropHAlign, imageCropHeight]);

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

const isCustomCaption = (alt: string | null | undefined): boolean => {
    if (!alt) return false;
    const trimmed = alt.trim();
    if (!trimmed) return false;
    const lower = trimmed.toLowerCase();
    
    const placeholders = [
        'character portrait',
        'character-portrait',
        'image',
        'avatar',
        'user portrait',
        'user-portrait',
        'attachment',
        'file',
        'portrait'
    ];
    
    if (placeholders.includes(lower)) return false;
    
    // 경로 형태(슬래시 포함) 및 RisuAI 가상 경로명 필터링
    if (lower.startsWith('/sw/') || lower.includes('/') || lower.includes('\\')) return false;
    if (lower.startsWith('http://') || lower.startsWith('https://')) return false;
    if (lower.startsWith('data:') || lower.startsWith('blob:')) return false;
    
    // 파일 확장자 및 난수 해시 파일명 필터링
    if (/\.(png|jpe?g|webp|gif|bmp)$/i.test(lower)) return false;
    if (/^[a-f0-9\-_]+$/i.test(lower) && lower.length > 8) return false;
    
    return true;
};

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

        // wrapper를 원래 img가 있던 자리에 먼저 삽입해 둡니다. (img가 자식에서 분리되기 전)
        parent.insertBefore(wrapper, img);

        // 1. 크롭 레이어(wrapper) 구성 및 원본 이미지 크롭 스타일 지정
        let imageToAppend: HTMLElement = img;
        if (imageCropActive) {
            const cropWrapper = document.createElement('div');
            let aspect = '';
            switch (imageCropAspectRatio) {
                case '1:1': aspect = '1 / 1'; break;
                case '3:4': aspect = '3 / 4'; break;
                case '4:3': aspect = '4 / 3'; break;
                case '9:16': aspect = '9 / 16'; break;
                case '16:9': aspect = '16 / 9'; break;
                case 'custom': aspect = `1 / ${imageCropHeight || 1.0}`; break;
                default: break;
            }

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

            console.log('[log plugin] Setting img objectPosition to:', `${imageCropHAlign !== undefined ? imageCropHAlign : 50}% ${imageCropVAlign !== undefined ? imageCropVAlign : 50}%`);
            img.style.setProperty('width', '100%', 'important');
            img.style.setProperty('height', '100%', 'important');
            img.style.setProperty('object-fit', 'cover', 'important');
            img.style.setProperty('object-position', `${imageCropHAlign !== undefined ? imageCropHAlign : 50}% ${imageCropVAlign !== undefined ? imageCropVAlign : 50}%`, 'important');
            img.style.setProperty('display', 'block', 'important');
            img.style.setProperty('max-width', '100%', 'important');

            cropWrapper.appendChild(img);
            imageToAppend = cropWrapper;
        } else {
            // 크롭 미적용 시의 표준 스타일
            img.style.maxWidth = `${scale}%`;
            img.style.width = `${scale}%`;
            img.style.height = 'auto';
            img.style.display = 'inline-block';
            img.style.verticalAlign = 'middle';
        }

        // 2. 테마별 프레임 씌우기
        switch (styleMode) {
            case 'gallery': {
                // 클래식 액자: 3D 입체 에보니 원목 2단 프레임 + 이중 크림 매트보드 + 베벨 컷 이미지 윈도우
                const frame = document.createElement('div');
                Object.assign(frame.style, {
                    display: 'inline-flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    backgroundColor: '#181818',
                    border: '12px solid #111111', // 1단 외곽 원목 몰딩
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
                    // 광원에 따른 3D 음영을 구현한 2단 베벨 몰딩 테두리
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
                
                const hasCaption = isCustomCaption(img.alt);
                const mat = document.createElement('div');
                Object.assign(mat.style, {
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    backgroundColor: '#f5f3eb', // 정통 파인아트용 웜 크림 매트보드
                    padding: hasCaption ? '24px 24px 0' : '24px',
                    border: '1px solid #d8d4c7', // 매트 외곽선
                    boxShadow: 'inset 0 3px 8px rgba(0,0,0,0.06)',
                    width: '100%',
                    boxSizing: 'border-box',
                });

                // 이중 매트(Double Matting) 및 사선 베벨 컷 효과를 내는 윈도우 프레임
                const matWindow = document.createElement('div');
                Object.assign(matWindow.style, {
                    display: 'block',
                    backgroundColor: '#e6e3d8', // 이중 매트의 안쪽 어두운 레이어
                    padding: '3px',
                    border: '1px solid #c2bdb0',
                    boxShadow: 'inset 0 2px 4px rgba(0,0,0,0.1)',
                    width: '100%',
                    boxSizing: 'border-box',
                });

                // 최종 렌더링될 요소에 스타일(보더 및 섀도우) 부여
                imageToAppend.style.borderRadius = '0';
                imageToAppend.style.display = 'block';
                imageToAppend.style.width = '100%';
                imageToAppend.style.maxWidth = '100%';
                if (!imageCropActive) {
                    imageToAppend.style.height = 'auto';
                }
                imageToAppend.style.border = '1px solid #a8a499'; // 이미지와 안쪽 매트 경계선
                imageToAppend.style.boxShadow = '0 2px 4px rgba(0,0,0,0.15)';
                imageToAppend.style.boxSizing = 'border-box';

                wrapper.appendChild(frame);
                frame.appendChild(innerFrame);
                innerFrame.appendChild(mat);
                mat.appendChild(matWindow);
                matWindow.appendChild(imageToAppend);

                if (hasCaption) {
                    // 미술관 종이 라벨 스타일의 정갈한 자막 영역 (사용자가 명시적으로 커스텀 자막을 정의한 경우에만 렌더링)
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
                    caption.textContent = img.alt;

                    label.appendChild(caption);
                    labelContainer.appendChild(label);
                    mat.appendChild(labelContainer);
                }
                return;
            }
            case 'modern': {
                // 현대 액자: 넓은 화이트 패스파르투 + 플로팅 이미지 효과
                const hasCaption = isCustomCaption(img.alt);
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
                if (!imageCropActive) {
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
                    title.textContent = img.alt.toUpperCase();

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
                    boxShadow: '0 4px 12px rgba(0,0,0,0.12), 0 1px 3px rgba(0,0,0,0.06)',
                    transform: `rotate(${rotate}deg)`,
                    maxWidth: `${scale}%`,
                    boxSizing: 'border-box',
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

                imageToAppend.style.borderRadius = '1px';
                imageToAppend.style.width = '100%';
                imageToAppend.style.maxWidth = '100%';
                if (!imageCropActive) {
                    imageToAppend.style.height = 'auto';
                }
                imageToAppend.style.display = 'block';
                imageToAppend.style.boxSizing = 'border-box';

                wrapper.appendChild(inner);
                inner.appendChild(imageToAppend);
                return;
            }
            case 'none':
            default:
                break;
        }

        // 스타일 적용 'none'일 때 크롭 및 스케일 속성을 최종 적용
        if (imageCropActive) {
            imageToAppend.style.maxWidth = `${scale}%`;
            imageToAppend.style.width = `${scale}%`;
            imageToAppend.style.display = 'inline-block';
            imageToAppend.style.verticalAlign = 'middle';
        }

        wrapper.appendChild(imageToAppend);
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
