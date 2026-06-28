import type { ColorPalette } from '../../types';
import type { LogExportSettings } from '../../types';
import JSZip from 'jszip';
import { createRoot } from 'react-dom/client';
import LogContainer from '../components/LogContainer';
import { convertWebMToAnimatedWebP } from '../../services/webmConverter';
import { getLogHtml } from './htmlGenerator';
import { collectCharacterAvatars } from './avatarService';
import type { CharInfo } from '../../types';
import { loadGlobalSettings } from './settingsService';
import { mergePNGsBinary } from './image/png';
import { mergeJPEGsBinary } from './image/jpeg';
import { mergeWebPsBinary } from './image/webp';
import { imageUrlToBlob, fetchToBlobNative, hexToString } from '../utils/imageUtils';
import { message } from 'antd';
import {
    captureElementToBlob,
    createSectionWrapper,
    withTempWrapper,
    downloadBlob,
    type ImageLibrary,
    type ImageFormat,
} from '../utils/captureUtils';

const waitForMedia = async (element: HTMLElement) => {
    const images = Array.from(element.querySelectorAll('img'));
    const videos = Array.from(element.querySelectorAll('video'));

    const promises = [
        ...images.map(img => {
            if (img.complete) return Promise.resolve();
            return new Promise<void>(resolve => {
                img.onload = () => resolve();
                img.onerror = () => resolve();
            });
        }),
        ...videos.map(video => {
            if (video.readyState >= 2) return Promise.resolve();
            return new Promise<void>(resolve => {
                video.onloadeddata = () => resolve();
                video.onerror = () => resolve();
            });
        })
    ];

    if (promises.length === 0) return;

    await Promise.race([
        Promise.all(promises),
        new Promise(resolve => setTimeout(resolve, 5000)) // 5s timeout
    ]);
};

/**
 * 큰 메시지를 분할하여 캡처한 후 하나의 이미지로 병합합니다.
 */
const splitAndMergeAsOneFile = async (
    element: HTMLElement,
    maxHeight: number,
    resolution: number,
    format: ImageFormat,
    imageLibrary: ImageLibrary,
    bgColor: string,
    onProgressUpdate: (update: { message?: string }) => void
): Promise<Blob> => {
    const totalHeight = element.offsetHeight;
    const totalWidth = element.offsetWidth;
    const numSections = Math.ceil(totalHeight / maxHeight);

    onProgressUpdate({ message: `큰 이미지 분할 캡처 중 (${numSections}개 섹션)...` });

    const blobs: Blob[] = [];
    for (let i = 0; i < numSections; i++) {
        const startY = i * maxHeight;
        const sectionHeight = Math.min(maxHeight, totalHeight - startY);

        const wrapper = createSectionWrapper(element, startY, sectionHeight, totalWidth, bgColor);

        await withTempWrapper(wrapper, async () => {
            onProgressUpdate({ message: `[섹션 ${i + 1}/${numSections}] 캡처 중...` });

            const blob = await captureElementToBlob(
                wrapper, format, imageLibrary, bgColor, resolution, true
            );

            console.log(`[Log Exporter] Section ${i + 1} captured: ${blob.type} (requested: image/${format})`);
            blobs.push(blob);
        });
    }

    // 포맷에 따라 바이너리 레벨 병합 사용
    onProgressUpdate({ message: `이미지 병합 중...` });
    if (format === 'png') {
        console.log('[Log Exporter] Using PNG binary merge (no Canvas!)');
        return await mergePNGsBinary(blobs);
    } else if (format === 'jpeg') {
        console.log('[Log Exporter] Using JPEG binary merge (no Canvas!)');
        return await mergeJPEGsBinary(blobs);
    } else {
        console.log('[Log Exporter] Using WebP merge (PNG binary merge + WebP conversion)');
        return await mergeWebPsBinary(blobs);
    }
};

/**
 * 큰 메시지를 분할하여 여러 개의 개별 파일로 저장합니다.
 */
const splitAndSaveAsSeparateFiles = async (
    element: HTMLElement,
    maxHeight: number,
    resolution: number,
    format: ImageFormat,
    imageLibrary: ImageLibrary,
    bgColor: string,
    onProgressUpdate: (update: { message?: string }) => void,
    safeCharName: string,
    safeChatName: string,
    basePart: number,
    totalBaseParts: number
): Promise<void> => {
    const totalHeight = element.offsetHeight;
    const totalWidth = element.offsetWidth;
    const numSections = Math.ceil(totalHeight / maxHeight);

    onProgressUpdate({ message: `큰 이미지 분할 저장 중 (${numSections}개 섹션)...` });

    for (let i = 0; i < numSections; i++) {
        const startY = i * maxHeight;
        const sectionHeight = Math.min(maxHeight, totalHeight - startY);

        const wrapper = createSectionWrapper(element, startY, sectionHeight, totalWidth, bgColor);

        await withTempWrapper(wrapper, async () => {
            onProgressUpdate({ message: `[섹션 ${i + 1}/${numSections}] 캡처 중...` });

            const blob = await captureElementToBlob(
                wrapper, format, imageLibrary, bgColor, resolution, false
            );

            if (!blob) throw new Error('Failed to capture section');

            const sectionNumber = totalBaseParts > 1 ? `${basePart + 1}_${i + 1}` : `${i + 1}`;
            const filename = `Risu_Log_${safeCharName}_${safeChatName}_part${sectionNumber}.${format}`;

            onProgressUpdate({ message: `[섹션 ${i + 1}/${numSections}] 파일 저장 중...` });
            await downloadBlob(blob, filename);
        });
    }
};

/**
 * 요소 전체를 이미지로 캡처하여 Blob을 반환합니다.
 */
const captureElement = async (
    element: HTMLElement,
    format: ImageFormat,
    imageLibrary: ImageLibrary,
    bgColor: string,
    resolution: number
): Promise<Blob> => {
    return captureElementToBlob(element, format, imageLibrary, bgColor, resolution, false);
};

export const saveAsImage = async (
    nodes: HTMLElement[] | HTMLElement,
    format: ImageFormat,
    charName: string,
    chatName: string,
    options: LogExportSettings,
    backgroundColor?: string
) => {
    try {
        const {
            imageResolution: initialImageResolution = 1,
            imageLibrary = 'html-to-image',
            splitImage = 'none',
            maxImageHeight: userMaxImageHeight = 10000,
            onProgressStart = () => {},
            onProgressUpdate = () => {},
            onProgressEnd = () => {},
            ...htmlOptions
        } = options;

        const resolvedAvatarUrl = options.charAvatarUrl ? await imageUrlToBlob(options.charAvatarUrl) : '';
        const resolvedBannerUrl = htmlOptions.headerBannerUrl ? await imageUrlToBlob(htmlOptions.headerBannerUrl) : '';

        const BROWSER_MAX_HEIGHT = 16384;

        const renderImage = async (element: HTMLElement, resolution: number, part = 0, totalParts = 1) => {
            onProgressUpdate({ message: `[${part + 1}/${totalParts}] 이미지 데이터 생성 중...` });
            await new Promise(resolve => setTimeout(resolve, 50));
            const safeCharName = charName.replace(/[/?%*:|"<>]/g, '-');
            const safeChatName = chatName.replace(/[/?%*:|"<>]/g, '-');
            const filename = totalParts > 1
                ? `Risu_Log_${safeCharName}_${safeChatName}_part${part + 1}.${format}`
                : `Risu_Log_${safeCharName}_${safeChatName}.${format}`;

            const bgColor = backgroundColor || '#1a1b26';

            try {
                let blob: Blob | null = null;

                const finalMaxHeight = Math.min(userMaxImageHeight, Math.floor(BROWSER_MAX_HEIGHT / resolution));
                const isTooTall = element.offsetHeight > finalMaxHeight;

                if (isTooTall && (splitImage === 'chunk' || splitImage === 'message')) {
                    if (splitImage === 'chunk') {
                        blob = await splitAndMergeAsOneFile(
                            element,
                            finalMaxHeight,
                            resolution,
                            format,
                            imageLibrary as ImageLibrary,
                            bgColor,
                            onProgressUpdate
                        );
                    } else {
                        await splitAndSaveAsSeparateFiles(
                            element,
                            finalMaxHeight,
                            resolution,
                            format,
                            imageLibrary as ImageLibrary,
                            bgColor,
                            onProgressUpdate,
                            safeCharName,
                            safeChatName,
                            part,
                            totalParts
                        );
                        return;
                    }
                } else {
                    blob = await captureElement(
                        element,
                        format,
                        imageLibrary as ImageLibrary,
                        bgColor,
                        resolution
                    );
                }

                if (!blob) {
                    throw new Error('Failed to generate image blob.');
                }

                onProgressUpdate({ message: `[${part + 1}/${totalParts}] 파일 다운로드 중...` });
                await new Promise(resolve => setTimeout(resolve, 50));

                await downloadBlob(blob, filename);
            } catch (error) {
                console.error('Error saving image part:', error);
                message.error(`이미지 파트 ${part + 1} 저장 중 오류가 발생했습니다.`);
            }
        };

        const getChunks = (nodesToChunk: HTMLElement[], resolutionForChunking: number) => {
            const chunks: { nodes: HTMLElement[] }[] = [];
            const effectiveMaxHeight = Math.floor(BROWSER_MAX_HEIGHT / resolutionForChunking);
            const maxNodeChunkHeight = Math.min(userMaxImageHeight, effectiveMaxHeight);

            if (splitImage === 'message') {
                let currentChunk: HTMLElement[] = [];
                let currentHeight = 0;
                const tempRenderDiv = document.createElement('div');
                tempRenderDiv.style.position = 'absolute';
                tempRenderDiv.style.top = '-9999px';
                tempRenderDiv.style.left = '-9999px';
                tempRenderDiv.style.width = `${htmlOptions.previewWidth || 900}px`;
                document.body.appendChild(tempRenderDiv);

                for (const node of nodesToChunk) {
                    const nodeClone = node.cloneNode(true) as HTMLElement;
                    tempRenderDiv.appendChild(nodeClone);
                    const nodeHeight = nodeClone.offsetHeight;
                    tempRenderDiv.removeChild(nodeClone);

                    if (currentHeight + nodeHeight > maxNodeChunkHeight && currentChunk.length > 0) {
                        chunks.push({ nodes: currentChunk });
                        currentChunk = [node];
                        currentHeight = nodeHeight;
                    } else {
                        currentChunk.push(node);
                        currentHeight += nodeHeight;
                    }
                }
                if (currentChunk.length > 0) {
                    chunks.push({ nodes: currentChunk });
                }
                document.body.removeChild(tempRenderDiv);
            } else {
                chunks.push({ nodes: nodesToChunk });
            }
            return chunks;
        };

        const computeAutoResolution = (height: number): number => {
            if (height > 0 && height * 4 <= BROWSER_MAX_HEIGHT) return 4;
            if (height > 0 && height * 3 <= BROWSER_MAX_HEIGHT) return 3;
            if (height > 0 && height * 2 <= BROWSER_MAX_HEIGHT) return 2;
            return 1;
        };

        const clampResolution = (resolution: number, elementHeight: number): number => {
            if (elementHeight * resolution > BROWSER_MAX_HEIGHT) {
                const clamped = Math.floor(BROWSER_MAX_HEIGHT / elementHeight);
                return Math.max(1, clamped);
            }
            return resolution;
        };

        onProgressStart('분할 이미지 계산 중...', 1);
        await new Promise(resolve => setTimeout(resolve, 50));

        if (!Array.isArray(nodes)) {
            const singleElement = nodes;
            const resolutionForChunking = initialImageResolution === 'auto' ? 1 : (initialImageResolution as number);
            const chunks = getChunks([singleElement], resolutionForChunking);

            onProgressStart(`이미지 생성 중...`, chunks.length);
            const container = document.createElement('div');
            container.style.position = 'absolute';
            container.style.top = '-9999px';
            container.style.left = '-9999px';
            document.body.appendChild(container);

            try {
                for (let i = 0; i < chunks.length; i++) {
                    const chunk = chunks[i];
                    const elementToRender = chunk.nodes[0];

                    container.innerHTML = '';
                    container.appendChild(elementToRender);

                    let finalResolution = initialImageResolution === 'auto'
                        ? computeAutoResolution(elementToRender.offsetHeight)
                        : (initialImageResolution as number);

                    const oldRes = finalResolution;
                    finalResolution = clampResolution(finalResolution, elementToRender.offsetHeight);
                    if (finalResolution !== oldRes) {
                        onProgressUpdate({ message: `[경고] 해상도(${oldRes}x)가 너무 높아 ${finalResolution}x로 자동 조정됨.` });
                    }

                    await waitForMedia(elementToRender);
                    await renderImage(elementToRender, finalResolution, i, chunks.length);
                }
            } finally {
                onProgressEnd();
                document.body.removeChild(container);
            }
            return;
        }

        const container = document.createElement('div');
        container.style.position = 'absolute';
        container.style.top = '-9999px';
        container.style.left = '-9999px';
        document.body.appendChild(container);

        try {
            const resolutionForChunking = initialImageResolution === 'auto' ? 1 : (initialImageResolution as number);
            const chunks = getChunks(nodes, resolutionForChunking);
            onProgressStart(`이미지 생성 중...`, chunks.length);
            await new Promise(resolve => setTimeout(resolve, 50));

            for (let i = 0; i < chunks.length; i++) {
                const chunk = chunks[i];
                const chunkNodes = chunk.nodes;
                onProgressUpdate({ current: i + 1, message: `[${i + 1}/${chunks.length}] 컴포넌트 렌더링 중...` });
                await new Promise(resolve => setTimeout(resolve, 50));

                const globalSettings = await loadGlobalSettings();
                await new Promise<void>(resolve => {
                    const onReady = () => resolve();
                    const props = {
                        nodes: chunkNodes,
                        charInfo: { name: charName, chatName: chatName, avatarUrl: resolvedAvatarUrl },
                        selectedThemeKey: htmlOptions.theme as import("../../types").ThemeKey | undefined,
                        selectedColorKey: htmlOptions.color as import("../../types").ColorKey | undefined,
                        color: htmlOptions.color as ColorPalette | undefined,
                        showAvatar: htmlOptions.showAvatar,
                        showHeader: htmlOptions.showHeader,
                        showHeaderIcon: htmlOptions.showHeaderIcon,
                        headerTags: htmlOptions.headerTags,
                        headerLayout: htmlOptions.headerLayout,
                        headerBannerUrl: resolvedBannerUrl,
                        headerBannerBlur: htmlOptions.headerBannerBlur,
                        headerBannerAlign: htmlOptions.headerBannerAlign,
                        showFooter: htmlOptions.showFooter,
                        footerLeft: htmlOptions.footerLeft,
                        footerCenter: htmlOptions.footerCenter,
                        footerRight: htmlOptions.footerRight,
                        showBubble: htmlOptions.showBubble,
                        embedImagesAsBlob: true,
                        globalSettings: globalSettings,
                        onReady: onReady,
                        fontSize: htmlOptions.htmlScaleFactor !== undefined ? 16 * Number(htmlOptions.htmlScaleFactor) : Number(htmlOptions.previewFontSize || 16),
                        containerWidth: htmlOptions.previewWidth,
                        imageScale: Number(htmlOptions.imageScale),
                        isForImageExport: true,
                        replacementRules: htmlOptions.replacementRules,
                    };
                    const root = createRoot(container);
                    root.render(<LogContainer {...props} />);
                });

                const elementToRender = container.firstChild as HTMLElement;
                if (!elementToRender) continue;

                let finalResolution = initialImageResolution === 'auto'
                    ? computeAutoResolution(elementToRender.offsetHeight)
                    : (initialImageResolution as number);

                if (initialImageResolution === 'auto') {
                    const height = elementToRender.offsetHeight;
                    onProgressUpdate({ message: `[${i + 1}/${chunks.length}] 자동 해상도 결정: ${height}px -> ${finalResolution}x` });
                }

                const oldRes = finalResolution;
                finalResolution = clampResolution(finalResolution, elementToRender.offsetHeight);
                if (finalResolution !== oldRes) {
                    onProgressUpdate({ message: `[경고] 해상도(${oldRes}x)가 너무 높아 ${finalResolution}x로 자동 조정됨.` });
                }

                await waitForMedia(elementToRender);
                await renderImage(elementToRender, finalResolution, i, chunks.length);
                container.innerHTML = '';
            }
        } catch (error) {
            console.error('Error preparing images:', error);
            message.error('이미지 준비 중 오류가 발생했습니다.');
        } finally {
            onProgressEnd();
            document.body.removeChild(container);
        }
    } catch (e) {
        console.error('Error in saveAsImage:', e);
    }
};

export const downloadImagesAsZip = async (
    nodes: Element[],
    charInfo: CharInfo,
    sequentialNaming = false,
    showAvatar = true,
    convertWebM = false,
) => {
    console.log(`[Log Exporter] downloadImagesAsZip: Media ZIP download started`);
    try {
        const zip = new JSZip();
        const mediaPromises: Promise<void>[] = [];
        let mediaCounter = 0;
        const addedUrls = new Set<string>();

        const addMediaToZip = (el: HTMLImageElement | HTMLVideoElement) => {
            const isVideo = el.tagName === 'VIDEO';
            const src = isVideo ? (el.querySelector('source')?.src || el.src) : (el as HTMLImageElement).src;

            if (!src || src.startsWith('data:')) return;
            if (!sequentialNaming && addedUrls.has(src)) return;
            addedUrls.add(src);

            mediaCounter++;
            const baseFilename = `media_${String(mediaCounter).padStart(3, '0')}`;

            mediaPromises.push(
                fetchToBlobNative(src)
                    .then(async (blob) => {
                        const urlLower = src.toLowerCase();
                        const isWebMFromUrl = urlLower.includes('.webm') || urlLower.includes('2e7765626d');
                        const isWebMFromMime = blob.type.includes('webm');
                        const isWebM = isWebMFromUrl || isWebMFromMime;

                        if (convertWebM && isVideo && isWebM) {
                            console.log(`[Log Exporter] WebM file detected, converting to WebP: ${baseFilename}`);
                            try {
                                const file = new File([blob], 'video.webm', { type: 'video/webm' });
                                const webpBlob = await convertWebMToAnimatedWebP(file, null, null, 80);
                                zip.file(`${baseFilename}.webp`, webpBlob);
                                return;
                            } catch (e) {
                                console.error(`[Log Exporter] WebM conversion failed, saving original:`, e);
                            }
                        }

                        let extension: string | null = null;
                        const urlPath = src.split(/[?#]/)[0];
                        const filenamePart = urlPath.substring(urlPath.lastIndexOf('/') + 1);

                        const hexDotIndex = filenamePart.lastIndexOf('2e');
                        if (hexDotIndex !== -1 && hexDotIndex > 0) {
                            try {
                                const hexExt = filenamePart.substring(hexDotIndex + 2);
                                const decodedExt = hexToString(hexExt);
                                if (decodedExt.match(/^[a-z0-9]{1,5}$/i)) {
                                    extension = decodedExt;
                                }
                            } catch (e) {
                                console.warn('Failed to decode hex extension', e);
                            }
                        }

                        if (!extension) {
                            const lastDotIndex = urlPath.lastIndexOf('.');
                            if (lastDotIndex !== -1 && urlPath.length - lastDotIndex <= 5) {
                                extension = urlPath.substring(lastDotIndex + 1).toLowerCase();
                            }
                        }

                        if (!extension) {
                            console.error(`Could not find extension from URL, using default. URL: ${src}`);
                            extension = isVideo ? 'mp4' : 'png';
                        }

                        const filename = `${baseFilename}.${extension}`;
                        zip.file(filename, blob);
                    })
                    .catch(e => console.warn(`Failed to process/compress media: ${src}`, e))
            );
        };

        if (sequentialNaming) {
            const globalSettings = await loadGlobalSettings();
            const baseHtml = await getLogHtml({
                nodes: nodes,
                charInfo: charInfo,
                selectedThemeKey: 'basic',
                selectedColorKey: 'dark',
                showAvatar: showAvatar,
                isForArca: true,
                embedImagesAsBlob: false,
                globalSettings: globalSettings,
            });
            const tempDiv = document.createElement('div');
            tempDiv.innerHTML = baseHtml;
            tempDiv.querySelectorAll('img, video').forEach(el => addMediaToZip(el as HTMLImageElement | HTMLVideoElement));
        } else {
            const globalSettings = await loadGlobalSettings();
            const tempDiv = document.createElement('div');
            const html = await getLogHtml({
                nodes: nodes,
                charInfo: charInfo,
                selectedThemeKey: 'basic',
                selectedColorKey: 'dark',
                showAvatar: showAvatar,
                isForArca: false,
                embedImagesAsBlob: false,
                globalSettings: globalSettings,
            });
            tempDiv.innerHTML = html;

            if (showAvatar) {
                const avatarMap = await collectCharacterAvatars(Array.from(tempDiv.children), charInfo.name, false, globalSettings);
                for (const avatarUrl of avatarMap.values()) {
                    const fakeImg = document.createElement('img');
                    fakeImg.src = avatarUrl;
                    addMediaToZip(fakeImg);
                }
            }
            tempDiv.querySelectorAll('img, video').forEach(el => addMediaToZip(el as HTMLImageElement | HTMLVideoElement));
        }

        if (mediaPromises.length === 0) {
            message.warning('다운로드할 이미지나 비디오가 로그에 없습니다.');
            return;
        }

        await Promise.all(mediaPromises);
        const content = await zip.generateAsync({ type: "blob" });
        const safeCharName = charInfo.name.replace(/[/?%*:|"<>]/g, '-');
        const safeChatName = charInfo.chatName.replace(/[/?%*:|"<>]/g, '-');
        const zipFilename = `Risu_Log_Media_${safeCharName}_${safeChatName}${sequentialNaming ? '_Arca' : ''}.zip`;

        await downloadBlob(content, zipFilename);
    } catch (error) {
        console.error('[Log Exporter] Error creating ZIP file:', error);
        message.error('미디어 ZIP 파일 생성 중 오류가 발생했습니다.');
    }
};
