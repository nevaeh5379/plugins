import type { ColorPalette, ColorKey, ThemeKey } from '../../types';
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
import { createOffscreenContainer } from '../utils/domUtils';
import { message } from 'antd';
import {
    captureElementToBlob,
    createSectionWrapper,
    withTempWrapper,
    downloadBlob,
    type ImageLibrary,
    type ImageFormat,
} from '../utils/captureUtils';

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

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
 * 분할된 섹션을 순회하며 캡처하는 공통 로직
 */
const forEachSection = async (
    element: HTMLElement,
    maxHeight: number,
    resolution: number,
    format: ImageFormat,
    imageLibrary: ImageLibrary,
    bgColor: string,
    preserveWebpAsset: boolean,
    onProgressUpdate: (update: { message?: string }) => void,
    onSectionBlob: (blob: Blob, index: number, totalSections: number) => Promise<void>
): Promise<void> => {
    const totalHeight = element.offsetHeight;
    const totalWidth = element.offsetWidth;
    const numSections = Math.ceil(totalHeight / maxHeight);

    onProgressUpdate({ message: `큰 이미지 분할 캡처 중 (${numSections}개 섹션)...` });

    for (let i = 0; i < numSections; i++) {
        const startY = i * maxHeight;
        const sectionHeight = Math.min(maxHeight, totalHeight - startY);

        const wrapper = createSectionWrapper(element, startY, sectionHeight, totalWidth, bgColor);

        await withTempWrapper(wrapper, async () => {
            onProgressUpdate({ message: `[섹션 ${i + 1}/${numSections}] 캡처 중...` });
            await sleep(50);

            const blob = await captureElementToBlob(
                wrapper, format, imageLibrary, bgColor, resolution, preserveWebpAsset
            );

            console.log(`[Log Exporter] Section ${i + 1} captured: ${blob.type} (requested: image/${format})`);
            await onSectionBlob(blob, i, numSections);
        });
    }
};

const mergeBlobsByFormat = async (blobs: Blob[], format: ImageFormat, onProgressUpdate: (update: { message?: string }) => void): Promise<Blob> => {
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
    const blobs: Blob[] = [];
    await forEachSection(
        element, maxHeight, resolution, format, imageLibrary, bgColor, true,
        onProgressUpdate,
        async (blob) => { blobs.push(blob); }
    );
    return mergeBlobsByFormat(blobs, format, onProgressUpdate);
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
    await forEachSection(
        element, maxHeight, resolution, format, imageLibrary, bgColor, false,
        onProgressUpdate,
        async (blob, i, numSections) => {
            if (!blob) throw new Error('Failed to capture section');

            const sectionNumber = totalBaseParts > 1 ? `${basePart + 1}_${i + 1}` : `${i + 1}`;
            const filename = `Risu_Log_${safeCharName}_${safeChatName}_part${sectionNumber}.${format}`;

            onProgressUpdate({ message: `[섹션 ${i + 1}/${numSections}] 파일 저장 중...` });
            await sleep(50);
            await downloadBlob(blob, filename);
        }
    );
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

// --------------------------------------------------------------------
// Utility helpers
// --------------------------------------------------------------------

const BROWSER_MAX_HEIGHT = 16384;

const sanitizeFilename = (name: string): string => name.replace(/[/?%*:|"<>]/g, '-');

/** Export 파일명 생성 */
const buildExportFilename = (
    charName: string,
    chatName: string,
    format: string,
    part?: number,
    totalParts?: number
): string => {
    const safeChar = sanitizeFilename(charName);
    const safeChat = sanitizeFilename(chatName);
    if (totalParts && totalParts > 1 && part !== undefined) {
        return `Risu_Log_${safeChar}_${safeChat}_part${part + 1}.${format}`;
    }
    return `Risu_Log_${safeChar}_${safeChat}.${format}`;
};

/** avatar / banner URL 을 blob URL 로 변환 */
const resolveAssetUrls = async (
    options: LogExportSettings
): Promise<{ avatarUrl: string; bannerUrl: string }> => {
    const avatarUrl = options.charAvatarUrl ? await imageUrlToBlob(options.charAvatarUrl) : '';
    const bannerUrl = (options as Record<string, unknown>).headerBannerUrl
        ? await imageUrlToBlob((options as Record<string, unknown>).headerBannerUrl as string)
        : '';
    return { avatarUrl, bannerUrl };
};

/** 요소 높이에 기반한 최대 해상도 자동 계산 */
const computeAutoResolution = (height: number): number => {
    if (height > 0 && height * 4 <= BROWSER_MAX_HEIGHT) return 4;
    if (height > 0 && height * 3 <= BROWSER_MAX_HEIGHT) return 3;
    if (height > 0 && height * 2 <= BROWSER_MAX_HEIGHT) return 2;
    return 1;
};

/** 브라우저 제한 내에서 해상도 clamp */
const clampResolution = (resolution: number, elementHeight: number): number => {
    if (elementHeight * resolution > BROWSER_MAX_HEIGHT) {
        const clamped = Math.floor(BROWSER_MAX_HEIGHT / elementHeight);
        return Math.max(1, clamped);
    }
    return resolution;
};

/** 최종 해상도 결정 (auto 계산 + clamp 적용 + 경고 메시지) */
const computeFinalResolution = (
    initialResolution: number | 'auto',
    elementHeight: number,
    onProgressUpdate: (update: { message?: string }) => void
): number => {
    let finalResolution = initialResolution === 'auto'
        ? computeAutoResolution(elementHeight)
        : (initialResolution as number);

    const oldRes = finalResolution;
    finalResolution = clampResolution(finalResolution, elementHeight);
    if (finalResolution !== oldRes) {
        onProgressUpdate({ message: `[경고] 해상도(${oldRes}x)가 너무 높아 ${finalResolution}x로 자동 조정됨.` });
    }
    return finalResolution;
};

// --------------------------------------------------------------------
// Chunking
// --------------------------------------------------------------------

/** 노드 배열을 높이 기준으로 chunk 로 분할 */
const chunkNodesByHeight = (
    nodes: HTMLElement[],
    splitImage: string,
    userMaxImageHeight: number,
    initialImageResolution: number | 'auto',
    previewWidth?: number
): { nodes: HTMLElement[] }[] => {
    if (splitImage !== 'message') {
        return [{ nodes }];
    }

    const resolutionForChunking = initialImageResolution === 'auto' ? 1 : (initialImageResolution as number);
    const effectiveMaxHeight = Math.floor(BROWSER_MAX_HEIGHT / resolutionForChunking);
    const maxNodeChunkHeight = Math.min(userMaxImageHeight, effectiveMaxHeight);

    const chunks: { nodes: HTMLElement[] }[] = [];
    let currentChunk: HTMLElement[] = [];
    let currentHeight = 0;
    const { container: tempRenderDiv, remove: removeRenderDiv } = createOffscreenContainer(previewWidth || 900);

    try {
        for (const node of nodes) {
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
    } finally {
        removeRenderDiv();
    }

    return chunks;
};

// --------------------------------------------------------------------
// React rendering
// --------------------------------------------------------------------

/** chunk 노드를 React LogContainer 로 렌더링하여 HTMLElement 반환 */
const renderChunkAsReactComponent = async (
    container: HTMLElement,
    chunkNodes: HTMLElement[],
    charName: string,
    chatName: string,
    resolvedAvatarUrl: string,
    resolvedBannerUrl: string,
    htmlOptions: Record<string, unknown>,
    onProgressUpdate: (update: { message?: string }) => void,
    chunkIndex: number,
    totalChunks: number
): Promise<HTMLElement | null> => {
    const globalSettings = await loadGlobalSettings();

    return await new Promise<HTMLElement | null>(resolve => {
        const onReady = () => {
            resolve(container.firstChild as HTMLElement | null);
        };

        const props = {
            nodes: chunkNodes,
            charInfo: { name: charName, chatName: chatName, avatarUrl: resolvedAvatarUrl },
            selectedThemeKey: htmlOptions.theme as ThemeKey | undefined,
            selectedColorKey: htmlOptions.color as ColorKey | undefined,
            color: htmlOptions.color as ColorPalette | undefined,
            showAvatar: htmlOptions.showAvatar as boolean | undefined,
            showHeader: htmlOptions.showHeader as boolean | undefined,
            showHeaderIcon: htmlOptions.showHeaderIcon as boolean | undefined,
            headerTags: htmlOptions.headerTags as string | undefined,
            headerLayout: htmlOptions.headerLayout as 'default' | 'compact' | 'banner' | 'smart' | 'cover' | undefined,
            headerBannerUrl: resolvedBannerUrl,
            headerBannerBlur: htmlOptions.headerBannerBlur as boolean | undefined,
            headerBannerAlign: htmlOptions.headerBannerAlign as number | undefined,
            showFooter: htmlOptions.showFooter as boolean | undefined,
            footerLeft: htmlOptions.footerLeft as string | undefined,
            footerCenter: htmlOptions.footerCenter as string | undefined,
            footerRight: htmlOptions.footerRight as string | undefined,
            showBubble: htmlOptions.showBubble as boolean | undefined,
            embedImagesAsBlob: true,
            globalSettings: globalSettings,
            onReady: onReady,
            fontSize: htmlOptions.htmlScaleFactor !== undefined
                ? 16 * Number(htmlOptions.htmlScaleFactor)
                : Number(htmlOptions.previewFontSize || 16),
            containerWidth: htmlOptions.previewWidth as number | undefined,
            imageScale: Number(htmlOptions.imageScale),
            isForImageExport: true,
            replacementRules: htmlOptions.replacementRules as import('../../types').ReplacementRule[] | undefined,
        };

        onProgressUpdate({
            message: `[${chunkIndex + 1}/${totalChunks}] 컴포넌트 렌더링 중...`,
        });

        const root = createRoot(container);
        root.render(<LogContainer {...props} />);
    });
};

// --------------------------------------------------------------------
// Capture & Save
// --------------------------------------------------------------------

/** 단일 요소 캡처 → (필요시 분할/병합) → 다운로드 */
const captureAndSaveElement = async (
    element: HTMLElement,
    resolution: number,
    part: number,
    totalParts: number,
    format: ImageFormat,
    imageLibrary: string,
    splitImage: string,
    userMaxImageHeight: number,
    charName: string,
    chatName: string,
    backgroundColor: string,
    onProgressUpdate: (update: { message?: string }) => void
): Promise<void> => {
    onProgressUpdate({ message: `[${part + 1}/${totalParts}] 이미지 데이터 생성 중...` });
    await sleep(50);

    const filename = buildExportFilename(charName, chatName, format, part, totalParts);
    const finalMaxHeight = Math.min(userMaxImageHeight, Math.floor(BROWSER_MAX_HEIGHT / resolution));
    const isTooTall = element.offsetHeight > finalMaxHeight;

    let blob: Blob | null = null;

    if (isTooTall && (splitImage === 'chunk' || splitImage === 'message')) {
        if (splitImage === 'chunk') {
            blob = await splitAndMergeAsOneFile(
                element,
                finalMaxHeight,
                resolution,
                format,
                imageLibrary as ImageLibrary,
                backgroundColor,
                onProgressUpdate
            );
        } else {
            await splitAndSaveAsSeparateFiles(
                element,
                finalMaxHeight,
                resolution,
                format,
                imageLibrary as ImageLibrary,
                backgroundColor,
                onProgressUpdate,
                sanitizeFilename(charName),
                sanitizeFilename(chatName),
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
            backgroundColor,
            resolution
        );
    }

    if (!blob) {
        throw new Error('Failed to generate image blob.');
    }

    onProgressUpdate({ message: `[${part + 1}/${totalParts}] 파일 다운로드 중...` });
    await sleep(50);
    await downloadBlob(blob, filename);
};

// --------------------------------------------------------------------
// Pipeline: single node
// --------------------------------------------------------------------

/** 단일 HTMLElement export 파이프라인 */
const processSingleNode = async (
    node: HTMLElement,
    format: ImageFormat,
    charName: string,
    chatName: string,
    initialImageResolution: number | 'auto',
    imageLibrary: string,
    splitImage: string,
    userMaxImageHeight: number,
    backgroundColor: string,
    onProgressStart: (message: string, total: number) => void,
    onProgressUpdate: (update: { message?: string }) => void,
    onProgressEnd: () => void,
    previewWidth?: number
): Promise<void> => {
    const chunks = chunkNodesByHeight(
        [node],
        splitImage,
        userMaxImageHeight,
        initialImageResolution,
        previewWidth
    );

    onProgressStart(`이미지 생성 중...`, chunks.length);
    const { container, remove } = createOffscreenContainer();

    try {
        for (let i = 0; i < chunks.length; i++) {
            const elementToRender = chunks[i].nodes[0];

            container.innerHTML = '';
            container.appendChild(elementToRender);

            const finalResolution = computeFinalResolution(
                initialImageResolution,
                elementToRender.offsetHeight,
                onProgressUpdate
            );

            await waitForMedia(elementToRender);
            await captureAndSaveElement(
                elementToRender,
                finalResolution,
                i,
                chunks.length,
                format,
                imageLibrary,
                splitImage,
                userMaxImageHeight,
                charName,
                chatName,
                backgroundColor,
                onProgressUpdate
            );
        }
    } finally {
        onProgressEnd();
        remove();
    }
};

// --------------------------------------------------------------------
// Pipeline: node array
// --------------------------------------------------------------------

/** HTMLElement[] export 파이프라인 (React 렌더링 포함) */
const processNodeArray = async (
    nodes: HTMLElement[],
    format: ImageFormat,
    charName: string,
    chatName: string,
    initialImageResolution: number | 'auto',
    imageLibrary: string,
    splitImage: string,
    userMaxImageHeight: number,
    backgroundColor: string,
    resolvedAvatarUrl: string,
    resolvedBannerUrl: string,
    htmlOptions: Record<string, unknown>,
    onProgressStart: (message: string, total: number) => void,
    onProgressUpdate: (update: { message?: string; current?: number }) => void,
    onProgressEnd: () => void
): Promise<void> => {
    const chunks = chunkNodesByHeight(
        nodes,
        splitImage,
        userMaxImageHeight,
        initialImageResolution
    );

    onProgressStart(`이미지 생성 중...`, chunks.length);
    await sleep(50);

    const { container, remove } = createOffscreenContainer();

    try {
        for (let i = 0; i < chunks.length; i++) {
            const chunkNodes = chunks[i].nodes;
            await sleep(50);

            const elementToRender = await renderChunkAsReactComponent(
                container,
                chunkNodes,
                charName,
                chatName,
                resolvedAvatarUrl,
                resolvedBannerUrl,
                htmlOptions,
                onProgressUpdate,
                i,
                chunks.length
            );
            if (!elementToRender) continue;

            const finalResolution = computeFinalResolution(
                initialImageResolution,
                elementToRender.offsetHeight,
                onProgressUpdate
            );

            // auto 모드일 때 해상도 정보 출력
            if (initialImageResolution === 'auto') {
                const height = elementToRender.offsetHeight;
                onProgressUpdate({
                    message: `[${i + 1}/${chunks.length}] 자동 해상도 결정: ${height}px -> ${finalResolution}x`,
                });
            }

            await waitForMedia(elementToRender);
            await captureAndSaveElement(
                elementToRender,
                finalResolution,
                i,
                chunks.length,
                format,
                imageLibrary,
                splitImage,
                userMaxImageHeight,
                charName,
                chatName,
                backgroundColor,
                onProgressUpdate
            );
            container.innerHTML = '';
        }
    } catch (error) {
        console.error('Error preparing images:', error);
        message.error('이미지 준비 중 오류가 발생했습니다.');
    } finally {
        onProgressEnd();
        remove();
    }
};

// --------------------------------------------------------------------
// Main entry
// --------------------------------------------------------------------

/**
 * 로그 노드를 이미지로 내보냅니다.
 * - 단일 요소: DOM 직접 조작
 * - 노드 배열: React LogContainer 렌더링 후 캡처
 */
export const saveAsImage = async (
    nodes: HTMLElement[] | HTMLElement,
    format: ImageFormat,
    charName: string,
    chatName: string,
    options: LogExportSettings,
    backgroundColor?: string
): Promise<void> => {
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

        const { avatarUrl: resolvedAvatarUrl, bannerUrl: resolvedBannerUrl } =
            await resolveAssetUrls(options);

        const bgColor = backgroundColor || '#1a1b26';

        onProgressStart('분할 이미지 계산 중...', 1);
        await sleep(50);

        if (!Array.isArray(nodes)) {
            await processSingleNode(
                nodes,
                format,
                charName,
                chatName,
                initialImageResolution,
                imageLibrary,
                splitImage,
                userMaxImageHeight,
                bgColor,
                onProgressStart,
                onProgressUpdate,
                onProgressEnd,
                (htmlOptions as Record<string, unknown>).previewWidth as number | undefined
            );
            return;
        }

        await processNodeArray(
            nodes,
            format,
            charName,
            chatName,
            initialImageResolution,
            imageLibrary,
            splitImage,
            userMaxImageHeight,
            bgColor,
            resolvedAvatarUrl,
            resolvedBannerUrl,
            htmlOptions as Record<string, unknown>,
            onProgressStart,
            onProgressUpdate,
            onProgressEnd
        );
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
            try {
                tempDiv.innerHTML = baseHtml;
                tempDiv.querySelectorAll('img, video').forEach(el => addMediaToZip(el as HTMLImageElement | HTMLVideoElement));
            } finally {
                tempDiv.innerHTML = '';
            }
        } else {
            const globalSettings = await loadGlobalSettings();
            const tempDiv = document.createElement('div');
            try {
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
            } finally {
                tempDiv.innerHTML = '';
            }
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
