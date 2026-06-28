import { getLogHtml } from './htmlGenerator';
import type { LogNode, ArcaImage, LogExportSettings, CharInfo, GlobalSettings } from '../../types';

export const generateArcaContent = async (nodes: LogNode[], settings: LogExportSettings, options: { convertWebM: boolean }, charInfo: CharInfo, globalSettings: GlobalSettings): Promise<{ html: string, images: ArcaImage[] }> => {
    // 1. 기본 테마와 다크 색상을 사용하여 깨끗한 HTML 생성
    const html = await getLogHtml({
        nodes,
        charInfo,
        selectedThemeKey: 'basic',
        selectedColorKey: 'dark',
        showAvatar: settings.showAvatar,
        showHeader: settings.showHeader,
        showFooter: settings.showFooter,
        showBubble: settings.showBubble,
        embedImagesAsBlob: false, // URL을 그대로 사용
        globalSettings,
        isForArca: true,
        allowHtmlRendering: settings.allowHtmlRendering ?? false,
        disableAnimations: settings.disableAnimations ?? false,
        imageCropActive: settings.imageCropActive ?? false,
        imageCropAspectRatio: settings.imageCropAspectRatio ?? 'original',
        imageCropVAlign: settings.imageCropVAlign ?? 50,
        imageCropHAlign: settings.imageCropHAlign ?? 50,
        imageCropHeight: settings.imageCropHeight ?? 1,
        imageScale: settings.imageScale !== undefined ? Number(settings.imageScale) : 100,
        imageAlign: settings.imageAlign ?? 'left',
        imageStyle: settings.imageStyle ?? 'none',
    });

    const tempDiv = document.createElement('div');
    tempDiv.innerHTML = html;

    const images: ArcaImage[] = [];
    let mediaCounter = 0;
    const addedUrls = new Set<string>();

    const mediaElements = Array.from(tempDiv.querySelectorAll('img, video'));

    for (const el of mediaElements) {
        const isVideo = el.tagName === 'VIDEO';
        const src = isVideo ? ((el as HTMLVideoElement).querySelector('source')?.src || (el as HTMLVideoElement).src) : (el as HTMLImageElement).src;

        if (!src || src.startsWith('data:') || addedUrls.has(src)) {
            continue;
        }
        addedUrls.add(src);

        mediaCounter++;
        
        const urlLower = src.toLowerCase();
        const isWebM = urlLower.includes('.webm') || urlLower.includes('2e7765626d');
        const extension = isWebM && options.convertWebM ? 'webp' : ((el as HTMLElement).dataset.extension || 'jpg'); // Fallback to jpg
        const filename = `media_${String(mediaCounter).padStart(3, '0')}.${extension}`;

        images.push({ url: src, filename, isWebM });

        // HTML의 src 속성을 새 파일 이름으로 교체
        if (isVideo) {
            const source = el.querySelector('source');
            if (source) source.src = filename;
            (el as HTMLVideoElement).src = filename;
            (el as HTMLVideoElement).poster = ''; // 포스터 이미지 제거
        } else {
            (el as HTMLImageElement).src = filename;
        }
    }

    // 아카라이브용 BBCode 생성
    const imageListBbcode = images.map(img => `[img]${img.filename}[/img]`).join('\n');
    const finalHtml = `[title]${charInfo.chatName}[/title]\n[content]${tempDiv.innerHTML}\n\n${imageListBbcode}[/content]`;

    return { html: finalHtml, images };
};