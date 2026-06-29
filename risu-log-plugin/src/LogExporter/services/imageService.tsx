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
    const bannerUrl = options.headerBannerUrl
        ? await imageUrlToBlob(options.headerBannerUrl)
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
    htmlOptions: Partial<LogExportSettings>,
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
            fontSize: htmlOptions.htmlScaleFactor !== undefined
                ? 16 * Number(htmlOptions.htmlScaleFactor)
                : Number(htmlOptions.previewFontSize || 16),
            containerWidth: htmlOptions.previewWidth as number | undefined,
            imageScale: htmlOptions.imageScale !== undefined ? Number(htmlOptions.imageScale) : 100,
            imageAlign: htmlOptions.imageAlign || 'left',
            imageStyle: htmlOptions.imageStyle || 'none',
            imageCropActive: !!htmlOptions.imageCropActive,
            imageCropAspectRatio: htmlOptions.imageCropAspectRatio || 'original',
            imageCropVAlign: htmlOptions.imageCropVAlign !== undefined ? Number(htmlOptions.imageCropVAlign) : 50,
            imageCropHAlign: htmlOptions.imageCropHAlign !== undefined ? Number(htmlOptions.imageCropHAlign) : 50,
            imageCropHeight: htmlOptions.imageCropHeight !== undefined ? Number(htmlOptions.imageCropHeight) : 1,
            isForArca: !!htmlOptions.isForArca,
            allowHtmlRendering: !!htmlOptions.allowHtmlRendering,
            disableAnimations: !!htmlOptions.disableAnimations,
            isForImageExport: true,
            replacementRules: htmlOptions.replacementRules,
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

/** 분할 전략에 따른 캡처 결과를 가져옵니다. */
const captureWithStrategy = async (
    element: HTMLElement,
    finalMaxHeight: number,
    resolution: number,
    format: ImageFormat,
    imageLibrary: ImageLibrary,
    backgroundColor: string,
    splitImage: string,
    onProgressUpdate: (update: { message?: string }) => void
): Promise<{ blob: Blob | null; isSeparateFiles: boolean }> => {
    if (splitImage === 'chunk') {
        const blob = await splitAndMergeAsOneFile(
            element, finalMaxHeight, resolution, format,
            imageLibrary, backgroundColor, onProgressUpdate
        );
        return { blob, isSeparateFiles: false };
    }
    if (splitImage === 'message') {
        return { blob: null, isSeparateFiles: true };
    }
    // 전체 캡처
    const blob = await captureElement(
        element, format, imageLibrary, backgroundColor, resolution
    );
    return { blob, isSeparateFiles: false };
};

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

    if (!isTooTall || splitImage === 'none') {
        // 분할 없이 전체 캡처
        const blob = await captureElement(
            element, format, imageLibrary as ImageLibrary,
            backgroundColor, resolution
        );
        if (!blob) throw new Error('Failed to generate image blob.');
        onProgressUpdate({ message: `[${part + 1}/${totalParts}] 파일 다운로드 중...` });
        await sleep(50);
        await downloadBlob(blob, filename);
        return;
    }

    // 분할 필요
    const { blob, isSeparateFiles } = await captureWithStrategy(
        element, finalMaxHeight, resolution, format,
        imageLibrary as ImageLibrary, backgroundColor,
        splitImage, onProgressUpdate
    );

    if (isSeparateFiles) {
        await splitAndSaveAsSeparateFiles(
            element, finalMaxHeight, resolution, format,
            imageLibrary as ImageLibrary, backgroundColor,
            onProgressUpdate,
            sanitizeFilename(charName), sanitizeFilename(chatName),
            part, totalParts
        );
        return;
    }

    if (!blob) {
        throw new Error('Failed to generate image blob.');
    }

    onProgressUpdate({ message: `[${part + 1}/${totalParts}] 파일 다운로드 중...` });
    await sleep(50);
    await downloadBlob(blob, filename);
};

// --------------------------------------------------------------------
// 공통 캡처 파이프라인
// --------------------------------------------------------------------

/** 각 chunk에 대해 캡처 작업을 실행하는 공통 루프 */
const runCapturePipeline = async (
    chunks: { nodes: HTMLElement[] }[],
    onProgressStart: (message: string, total: number) => void,
    onProgressEnd: () => void,
    onChunk: (
        container: HTMLElement,
        elementFromChunk: HTMLElement,
        index: number,
        total: number
    ) => Promise<void>,
    hasReactRender: boolean = false
): Promise<void> => {
    onProgressStart(`이미지 생성 중...`, chunks.length);
    if (hasReactRender) await sleep(50);

    const { container, remove } = createOffscreenContainer();

    try {
        for (let i = 0; i < chunks.length; i++) {
            await onChunk(container, chunks[i].nodes[0], i, chunks.length);
        }
    } catch (error) {
        console.error('Error preparing images:', error);
        if (hasReactRender) {
            message.error('이미지 준비 중 오류가 발생했습니다.');
        }
    } finally {
        onProgressEnd();
        remove();
    }
};

/** 단일 요소 캡처 → (필요시 분할/병합) → 다운로드 */
const performCaptureAndSave = async (
    elementToRender: HTMLElement,
    initialImageResolution: number | 'auto',
    format: ImageFormat,
    imageLibrary: string,
    splitImage: string,
    userMaxImageHeight: number,
    charName: string,
    chatName: string,
    backgroundColor: string,
    part: number,
    totalParts: number,
    onProgressUpdate: (update: { message?: string }) => void
): Promise<void> => {
    const finalResolution = computeFinalResolution(
        initialImageResolution,
        elementToRender.offsetHeight,
        onProgressUpdate
    );

    // auto 모드일 때 해상도 정보 출력
    if (initialImageResolution === 'auto') {
        const height = elementToRender.offsetHeight;
        onProgressUpdate({
            message: `[${part + 1}/${totalParts}] 자동 해상도 결정: ${height}px -> ${finalResolution}x`,
        });
    }

    await waitForMedia(elementToRender);
    await captureAndSaveElement(
        elementToRender,
        finalResolution,
        part,
        totalParts,
        format,
        imageLibrary,
        splitImage,
        userMaxImageHeight,
        charName,
        chatName,
        backgroundColor,
        onProgressUpdate
    );
};

// --------------------------------------------------------------------
// Pipeline: single node
// --------------------------------------------------------------------

/** 단일 노드 export 파이프라인 */
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

    await runCapturePipeline(
        chunks,
        onProgressStart,
        onProgressEnd,
        async (container, elementToRender, i, total) => {
            container.innerHTML = '';
            container.appendChild(elementToRender);
            await performCaptureAndSave(
                elementToRender, initialImageResolution, format,
                imageLibrary, splitImage, userMaxImageHeight,
                charName, chatName, backgroundColor,
                i, total, onProgressUpdate
            );
        }
    );
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
    htmlOptions: Partial<LogExportSettings>,
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

    await runCapturePipeline(
        chunks,
        onProgressStart,
        onProgressEnd,
        async (container, _elementFromChunk, i, total) => {
            const chunkNodes = chunks[i].nodes;
            await sleep(50);

            const elementToRender = await renderChunkAsReactComponent(
                container, chunkNodes,
                charName, chatName,
                resolvedAvatarUrl, resolvedBannerUrl,
                htmlOptions, onProgressUpdate,
                i, total
            );
            if (!elementToRender) return;

            await performCaptureAndSave(
                elementToRender, initialImageResolution, format,
                imageLibrary, splitImage, userMaxImageHeight,
                charName, chatName, backgroundColor,
                i, total, onProgressUpdate
            );
            container.innerHTML = '';
        },
        true // hasReactRender
    );
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
                htmlOptions.previewWidth
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
            htmlOptions,
            onProgressStart,
            onProgressUpdate,
            onProgressEnd
        );
    } catch (e) {
        console.error('Error in saveAsImage:', e);
        if (options.onProgressEnd) {
            try {
                options.onProgressEnd();
            } catch (err) {
                console.error('Error calling onProgressEnd in catch block:', err);
            }
        }
    }
};

// ──────────────────────────────────────────────
// ZIP 다운로드 유틸
// ──────────────────────────────────────────────

/** URL에서 파일 확장자를 감지합니다. */
const detectExtension = (src: string, isVideo: boolean): string => {
    const urlPath = src.split(/[?#]/)[0];
    const filenamePart = urlPath.substring(urlPath.lastIndexOf('/') + 1);

    // 16진수 인코딩된 확장자 (SW 이미지)
    const hexDotIndex = filenamePart.lastIndexOf('2e');
    if (hexDotIndex !== -1 && hexDotIndex > 0) {
        try {
            const hexExt = filenamePart.substring(hexDotIndex + 2);
            const decodedExt = hexToString(hexExt);
            if (decodedExt.match(/^[a-z0-9]{1,5}$/i)) {
                return decodedExt;
            }
        } catch {
            // ignore
        }
    }

    // 일반 파일 확장자
    const lastDotIndex = urlPath.lastIndexOf('.');
    if (lastDotIndex !== -1 && urlPath.length - lastDotIndex <= 5) {
        const ext = urlPath.substring(lastDotIndex + 1).toLowerCase();
        if (ext) return ext;
    }

    // 기본값
    return isVideo ? 'mp4' : 'png';
};

/** 미디어 요소를 ZIP에 추가합니다. Promise를 반환하여 모든 추가가 완료될 때까지 대기할 수 있습니다. */
const addMediaToZip = (
    el: HTMLImageElement | HTMLVideoElement,
    zip: JSZip,
    mediaCounter: { current: number },
    convertWebM: boolean,
    addedUrls: Set<string>
): Promise<void> => {
    const isVideo = el.tagName === 'VIDEO';
    const src = isVideo ? (el.querySelector('source')?.src || el.src) : el.src;

    if (!src || src.startsWith('data:')) return Promise.resolve();
    if (addedUrls.has(src)) return Promise.resolve();
    addedUrls.add(src);

    mediaCounter.current++;
    const baseFilename = `media_${String(mediaCounter.current).padStart(3, '0')}`;

    return fetchToBlobNative(src)
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

            const extension = detectExtension(src, isVideo);
            zip.file(`${baseFilename}.${extension}`, blob);
        })
        .catch(e => console.warn(`Failed to process/compress media: ${src}`, e));
};

/** HTML에서 img/video 요소를 수집하여 ZIP에 추가합니다. */
const collectMediaFromHtml = async (
    html: string,
    zip: JSZip,
    options: {
        mediaCounter: { current: number };
        convertWebM: boolean;
        addedUrls: Set<string>;
    }
): Promise<void> => {
    const tempDiv = document.createElement('div');
    try {
        tempDiv.innerHTML = html;
        const elements = Array.from(tempDiv.querySelectorAll('img, video'));
        await Promise.all(
            elements.map(el =>
                addMediaToZip(el as HTMLImageElement | HTMLVideoElement, zip, options.mediaCounter, options.convertWebM, options.addedUrls)
            )
        );
    } finally {
        tempDiv.innerHTML = '';
    }
};

/** 아바타 이미지를 ZIP에 추가합니다. */
const collectAvatarsForZip = async (
    tempDiv: HTMLDivElement,
    charName: string,
    globalSettings: import('../../types').GlobalSettings,
    zip: JSZip,
    mediaCounter: { current: number },
    addedUrls: Set<string>
): Promise<void> => {
    const avatarMap = await collectCharacterAvatars(Array.from(tempDiv.children), charName, false, globalSettings);
    const promises: Promise<void>[] = [];
    for (const avatarUrl of avatarMap.values()) {
        const fakeImg = document.createElement('img');
        fakeImg.src = avatarUrl;
        promises.push(addMediaToZip(fakeImg, zip, mediaCounter, false, addedUrls));
    }
    await Promise.all(promises);
};

/** ZIP 파일 생성 및 다운로드 */
const finalizeZipDownload = async (
    zip: JSZip,
    charInfo: CharInfo,
    sequentialNaming: boolean
): Promise<void> => {
    const content = await zip.generateAsync({ type: "blob" });
    const safeCharName = charInfo.name.replace(/[/?%*:|"<>]/g, '-');
    const safeChatName = charInfo.chatName.replace(/[/?%*:|"<>]/g, '-');
    const zipFilename = `Risu_Log_Media_${safeCharName}_${safeChatName}${sequentialNaming ? '_Arca' : ''}.zip`;

    await downloadBlob(content, zipFilename);
};

/** LogHtml 옵션 생성 헬퍼 */
const createLogHtmlOptions = (
    baseOptions: {
        nodes: Element[];
        charInfo: CharInfo;
        showAvatar: boolean;
        globalSettings: import('../../types').GlobalSettings;
    },
    extra: { isForArca: boolean }
): Omit<import('../../types').LogContainerProps, 'onReady'> => ({
    nodes: baseOptions.nodes,
    charInfo: baseOptions.charInfo,
    selectedThemeKey: 'basic',
    selectedColorKey: 'dark',
    showAvatar: baseOptions.showAvatar,
    isForArca: extra.isForArca,
    embedImagesAsBlob: false,
    globalSettings: baseOptions.globalSettings,
    allowHtmlRendering: false,
    disableAnimations: true,
    imageCropActive: false,
    imageCropAspectRatio: 'original',
    imageCropVAlign: 50,
    imageCropHAlign: 50,
    imageCropHeight: 1,
    imageScale: 100,
    imageAlign: 'left',
    imageStyle: 'none',
});

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
        const mediaCounter = { current: 0 };
        const addedUrls = new Set<string>();

        const globalSettings = await loadGlobalSettings();
        const baseOptions = { nodes, charInfo, showAvatar, globalSettings };

        if (sequentialNaming) {
            const html = await getLogHtml(createLogHtmlOptions(baseOptions, { isForArca: true }));
            await collectMediaFromHtml(html, zip, {
                mediaCounter,
                convertWebM,
                addedUrls,
            });
        } else {
            const html = await getLogHtml(createLogHtmlOptions(baseOptions, { isForArca: false }));
            const tempDiv = document.createElement('div');
            try {
                tempDiv.innerHTML = html;
                if (showAvatar) {
                    await collectAvatarsForZip(tempDiv, charInfo.name, globalSettings, zip, mediaCounter, addedUrls);
                }
                await collectMediaFromHtml(html, zip, {
                    mediaCounter,
                    convertWebM,
                    addedUrls,
                });
            } finally {
                tempDiv.innerHTML = '';
            }
        }

        await finalizeZipDownload(zip, charInfo, sequentialNaming);
    } catch (error) {
        console.error('[Log Exporter] Error creating ZIP file:', error);
        message.error('미디어 ZIP 파일 생성 중 오류가 발생했습니다.');
    }
};
