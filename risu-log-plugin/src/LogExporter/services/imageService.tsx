import type {
    ColorPalette,
    ColorKey,
    ThemeKey,
    CharInfo,
    GlobalSettings,
    LogContainerProps,
    LogExportSettings,
} from '../../types';
import JSZip from 'jszip';
import { createRoot, type Root } from 'react-dom/client';
import LogContainer from '../components/LogContainer';
import { convertWebMToAnimatedWebP } from '../../services/webmConverter';
import { getLogHtml } from './htmlGenerator';
import { collectCharacterAvatars } from './avatarService';
import { loadGlobalSettings } from './settingsService';
import { mergePNGsBinary } from './image/png';
import { mergeJPEGsBinary } from './image/jpeg';
import { mergeWebPsBinary } from './image/webp';
import { imageUrlToBlob, fetchToBlobNative, hexToString } from '../utils/imageUtils';
import { createOffscreenContainer } from '../utils/domUtils';
import { message } from '../../components/ui';
import {
    captureElementToBlob,
    createSectionWrapper,
    withTempWrapper,
    downloadBlob,
    type ImageLibrary,
    type ImageFormat,
} from '../utils/captureUtils';

// ============================================================================
// Constants & Configuration
// ============================================================================

/** Maximum browser canvas/texture dimension limit in pixels */
const BROWSER_MAX_HEIGHT = 16384;

/** Default background color used when none is provided */
const DEFAULT_BACKGROUND_COLOR = '#1a1b26';

/** Default image export resolution multiplier */
const DEFAULT_IMAGE_RESOLUTION = 1;

/** Default maximum single image height in pixels before chunking */
const DEFAULT_MAX_IMAGE_HEIGHT = 10000;

/** Default container width used during offscreen chunk measurement */
const DEFAULT_PREVIEW_WIDTH = 900;

/** Base font size in pixels for scaling calculations */
const DEFAULT_BASE_FONT_SIZE = 16;

/** Maximum time (ms) to wait for images and videos in an element to load */
const MEDIA_WAIT_TIMEOUT_MS = 5000;

/** Delay (ms) for UI / progress transitions */
const UI_TRANSITION_DELAY_MS = 150;

/** Short delay (ms) before triggering download */
const DOWNLOAD_PREPARATION_DELAY_MS = 50;

/** Short delay (ms) after showing resolution warning */
const WARNING_DISPLAY_DELAY_MS = 100;

/** Regex pattern for stripping illegal filename characters across platforms */
const FILENAME_SANITIZE_REGEX = /[/?%*:|"<>]/g;

/** Regex pattern for validating decoded hex file extensions */
const HEX_EXTENSION_REGEX = /^[a-z0-9]{1,5}$/i;

// ============================================================================
// General Helper Utilities
// ============================================================================

/**
 * Delays execution for the specified number of milliseconds.
 */
const delay = (ms: number): Promise<void> =>
    new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Sanitizes a string for use in safe file downloads.
 */
const sanitizeFilename = (name: string): string =>
    name.replace(FILENAME_SANITIZE_REGEX, '-');

/**
 * Waits for all `<img>` and `<video>` media within an element to finish loading.
 * Falls back to a timeout race to prevent indefinite blocking on broken assets.
 */
const waitForMedia = async (
    element: HTMLElement,
    timeoutMs = MEDIA_WAIT_TIMEOUT_MS
): Promise<void> => {
    const images = Array.from(element.querySelectorAll('img'));
    const videos = Array.from(element.querySelectorAll('video'));

    const promises: Promise<void>[] = [
        ...images.map((img) => {
            if (img.complete) return Promise.resolve();
            return new Promise<void>((resolve) => {
                img.onload = () => resolve();
                img.onerror = () => resolve();
            });
        }),
        ...videos.map((video) => {
            if (video.readyState >= 2) return Promise.resolve();
            return new Promise<void>((resolve) => {
                video.onloadeddata = () => resolve();
                video.onerror = () => resolve();
            });
        }),
    ];

    if (promises.length === 0) return;

    await Promise.race([
        Promise.all(promises),
        delay(timeoutMs),
    ]);
};

// ============================================================================
// Resolution & Scaling Utilities
// ============================================================================

/**
 * Automatically computes an optimal scale resolution multiplier based on element height.
 */
const computeAutoResolution = (height: number): number => {
    if (height > 0 && height * 4 <= BROWSER_MAX_HEIGHT) return 4;
    if (height > 0 && height * 3 <= BROWSER_MAX_HEIGHT) return 3;
    if (height > 0 && height * 2 <= BROWSER_MAX_HEIGHT) return 2;
    return 1;
};

/**
 * Clamps target resolution to prevent exceeding browser texture limit (BROWSER_MAX_HEIGHT).
 */
const clampResolution = (resolution: number, elementHeight: number): number => {
    if (elementHeight * resolution > BROWSER_MAX_HEIGHT) {
        const clamped = Math.floor(BROWSER_MAX_HEIGHT / elementHeight);
        return Math.max(1, clamped);
    }
    return resolution;
};

interface ResolveResolutionParams {
    imageResolutionSetting: number | 'auto';
    elementHeight: number;
    chunkIndex?: number;
    totalChunks?: number;
    onProgressUpdate: (update: { message?: string }) => void;
}

/**
 * Determines effective capture resolution, applying auto-scaling and clamping with warnings if needed.
 */
const resolveEffectiveResolution = async ({
    imageResolutionSetting,
    elementHeight,
    chunkIndex,
    totalChunks,
    onProgressUpdate,
}: ResolveResolutionParams): Promise<number> => {
    let resolution =
        imageResolutionSetting === 'auto'
            ? computeAutoResolution(elementHeight)
            : imageResolutionSetting;

    if (imageResolutionSetting === 'auto' && chunkIndex !== undefined && totalChunks !== undefined) {
        onProgressUpdate({
            message: `[${chunkIndex + 1}/${totalChunks}] 자동 해상도 결정: ${elementHeight}px -> ${resolution}x`,
        });
    }

    const requestedRes = resolution;
    resolution = clampResolution(resolution, elementHeight);

    if (resolution !== requestedRes) {
        onProgressUpdate({
            message: `[경고] 해상도(${requestedRes}x)가 너무 높아 ${resolution}x로 자동 조정됨.`,
        });
        await delay(WARNING_DISPLAY_DELAY_MS);
    }

    return resolution;
};

// ============================================================================
// Section Splitting & Binary Merging
// ============================================================================

/**
 * Iterates across vertical sections of an element, rendering and capturing each to a Blob.
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

            const blob = await captureElementToBlob(
                wrapper,
                format,
                imageLibrary,
                bgColor,
                resolution,
                preserveWebpAsset
            );

            console.log(`[Log Exporter] Section ${i + 1} captured: ${blob.type} (requested: image/${format})`);
            await onSectionBlob(blob, i, numSections);
        });
    }
};

/**
 * Merges an array of section Blobs into a single output image Blob using binary stitching.
 */
const mergeBlobsByFormat = async (
    blobs: Blob[],
    format: ImageFormat,
    onProgressUpdate: (update: { message?: string }) => void
): Promise<Blob> => {
    onProgressUpdate({ message: '이미지 병합 중...' });
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
 * Splits a tall element vertically, captures slices, and stitches them into a single file.
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
        element,
        maxHeight,
        resolution,
        format,
        imageLibrary,
        bgColor,
        true,
        onProgressUpdate,
        async (blob) => {
            blobs.push(blob);
        }
    );
    return mergeBlobsByFormat(blobs, format, onProgressUpdate);
};

/**
 * Splits a tall element vertically and triggers download for each slice as an independent file.
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
        element,
        maxHeight,
        resolution,
        format,
        imageLibrary,
        bgColor,
        false,
        onProgressUpdate,
        async (blob, i, numSections) => {
            if (!blob) throw new Error('Failed to capture section');

            const sectionNumber = totalBaseParts > 1 ? `${basePart + 1}_${i + 1}` : `${i + 1}`;
            const filename = `Risu_Log_${safeCharName}_${safeChatName}_part${sectionNumber}.${format}`;

            onProgressUpdate({ message: `[섹션 ${i + 1}/${numSections}] 파일 저장 중...` });
            await downloadBlob(blob, filename);
        }
    );
};

// ============================================================================
// Node Partitioning / Layout Chunking
// ============================================================================

interface ChunkPartition {
    nodes: HTMLElement[];
}

/**
 * Groups DOM nodes into vertical chunks to stay under maximum canvas and export height limits.
 */
const partitionNodesIntoChunks = (
    nodesToChunk: HTMLElement[],
    splitImage: LogExportSettings['splitImage'],
    userMaxImageHeight: number,
    resolutionForChunking: number,
    previewWidth = DEFAULT_PREVIEW_WIDTH
): ChunkPartition[] => {
    const chunks: ChunkPartition[] = [];
    const effectiveMaxHeight = Math.floor(BROWSER_MAX_HEIGHT / resolutionForChunking);
    const maxNodeChunkHeight = Math.min(userMaxImageHeight, effectiveMaxHeight);

    if (splitImage === 'message') {
        let currentChunk: HTMLElement[] = [];
        let currentHeight = 0;
        const { container: tempRenderDiv, remove: removeRenderDiv } = createOffscreenContainer(previewWidth);

        try {
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
        } finally {
            removeRenderDiv();
        }
    } else {
        chunks.push({ nodes: nodesToChunk });
    }

    return chunks;
};

// ============================================================================
// Single Element Capture & File Saving
// ============================================================================

interface RenderImageParams {
    element: HTMLElement;
    resolution: number;
    partIndex: number;
    totalParts: number;
    charName: string;
    chatName: string;
    format: ImageFormat;
    imageLibrary: ImageLibrary;
    splitImage: LogExportSettings['splitImage'];
    userMaxImageHeight: number;
    bgColor: string;
    onProgressUpdate: (update: { message?: string }) => void;
}

/**
 * Handles capturing an element chunk (with optional splitting) and saving the final file.
 */
const saveElementAsImage = async ({
    element,
    resolution,
    partIndex,
    totalParts,
    charName,
    chatName,
    format,
    imageLibrary,
    splitImage,
    userMaxImageHeight,
    bgColor,
    onProgressUpdate,
}: RenderImageParams): Promise<void> => {
    onProgressUpdate({ message: `[${partIndex + 1}/${totalParts}] 이미지 데이터 생성 중...` });
    await delay(UI_TRANSITION_DELAY_MS);

    const safeCharName = sanitizeFilename(charName);
    const safeChatName = sanitizeFilename(chatName);
    const filename =
        totalParts > 1
            ? `Risu_Log_${safeCharName}_${safeChatName}_part${partIndex + 1}.${format}`
            : `Risu_Log_${safeCharName}_${safeChatName}.${format}`;

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
                    imageLibrary,
                    bgColor,
                    onProgressUpdate
                );
            } else {
                await splitAndSaveAsSeparateFiles(
                    element,
                    finalMaxHeight,
                    resolution,
                    format,
                    imageLibrary,
                    bgColor,
                    onProgressUpdate,
                    safeCharName,
                    safeChatName,
                    partIndex,
                    totalParts
                );
                return;
            }
        } else {
            blob = await captureElementToBlob(
                element,
                format,
                imageLibrary,
                bgColor,
                resolution,
                false
            );
        }

        if (!blob) {
            throw new Error('Failed to generate image blob.');
        }

        onProgressUpdate({ message: `[${partIndex + 1}/${totalParts}] 파일 다운로드 중...` });
        await delay(DOWNLOAD_PREPARATION_DELAY_MS);

        await downloadBlob(blob, filename);
    } catch (error) {
        console.error('Error saving image part:', error);
        message.error(`이미지 파트 ${partIndex + 1} 저장 중 오류가 발생했습니다.`);
    }
};

// ============================================================================
// React LogContainer Props Builder & Offscreen Mounting
// ============================================================================

interface BuildLogContainerPropsParams {
    chunkNodes: HTMLElement[];
    charName: string;
    chatName: string;
    resolvedAvatarUrl: string;
    resolvedBannerUrl: string;
    globalSettings: GlobalSettings;
    htmlOptions: Omit<
        LogExportSettings,
        'imageResolution' | 'imageLibrary' | 'splitImage' | 'maxImageHeight' | 'onProgressStart' | 'onProgressUpdate' | 'onProgressEnd'
    >;
}

const buildLogContainerProps = ({
    chunkNodes,
    charName,
    chatName,
    resolvedAvatarUrl,
    resolvedBannerUrl,
    globalSettings,
    htmlOptions,
}: BuildLogContainerPropsParams): LogContainerProps => {
    const fontSize =
        htmlOptions.htmlScaleFactor !== undefined
            ? DEFAULT_BASE_FONT_SIZE * Number(htmlOptions.htmlScaleFactor)
            : Number(htmlOptions.previewFontSize || DEFAULT_BASE_FONT_SIZE);

    return {
        nodes: chunkNodes,
        charInfo: {
            name: charName,
            chatName: chatName,
            avatarUrl: resolvedAvatarUrl,
        },
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
        globalSettings,
        fontSize,
        containerWidth: htmlOptions.previewWidth,
        imageScale: Number(htmlOptions.imageScale),
        imageAlign: htmlOptions.imageAlign,
        imageStyle: htmlOptions.imageStyle,
        imageCropActive: htmlOptions.imageCropActive,
        imageCropAspectRatio: htmlOptions.imageCropAspectRatio,
        imageCropVAlign: htmlOptions.imageCropVAlign,
        imageCropHAlign: htmlOptions.imageCropHAlign,
        imageCropHeight: htmlOptions.imageCropHeight,
        disableAnimations: htmlOptions.disableAnimations,
        isForArca: htmlOptions.isForArca,
        allowHtmlRendering: htmlOptions.allowHtmlRendering,
        avatarPosition: htmlOptions.avatarPosition,
        avatarShape: htmlOptions.avatarShape,
        isForImageExport: true,
        replacementRules: htmlOptions.replacementRules,
    };
};

/**
 * Asynchronously mounts a LogContainer chunk into an offscreen container, resolving when onReady fires.
 */
const mountOffscreenLogContainer = (
    container: HTMLElement,
    props: LogContainerProps
): Promise<{ root: Root; element: HTMLElement | null }> => {
    return new Promise((resolve) => {
        let rootInstance: Root | null = null;
        const handleReady = () => {
            if (rootInstance) {
                resolve({
                    root: rootInstance,
                    element: container.firstChild as HTMLElement | null,
                });
            }
        };

        rootInstance = createRoot(container);
        rootInstance.render(<LogContainer {...props} onReady={handleReady} />);
    });
};

// ============================================================================
// Single Element & Node Array Export Pipelines
// ============================================================================

const exportSingleElementPipeline = async (
    singleElement: HTMLElement,
    format: ImageFormat,
    charName: string,
    chatName: string,
    options: LogExportSettings,
    bgColor: string
): Promise<void> => {
    const {
        imageResolution = DEFAULT_IMAGE_RESOLUTION,
        imageLibrary = 'html-to-image',
        splitImage = 'none',
        maxImageHeight = DEFAULT_MAX_IMAGE_HEIGHT,
        onProgressStart = () => {},
        onProgressUpdate = () => {},
        onProgressEnd = () => {},
        previewWidth = DEFAULT_PREVIEW_WIDTH,
    } = options;

    const resolutionForChunking = imageResolution === 'auto' ? 1 : imageResolution;
    const chunks = partitionNodesIntoChunks(
        [singleElement],
        splitImage,
        maxImageHeight,
        resolutionForChunking,
        previewWidth
    );

    onProgressStart('이미지 생성 중...', chunks.length);
    await delay(UI_TRANSITION_DELAY_MS);

    const { container, remove } = createOffscreenContainer();

    try {
        for (let i = 0; i < chunks.length; i++) {
            const chunk = chunks[i];
            const elementToRender = chunk.nodes[0];

            container.innerHTML = '';
            container.appendChild(elementToRender);

            const finalResolution = await resolveEffectiveResolution({
                imageResolutionSetting: imageResolution,
                elementHeight: elementToRender.offsetHeight,
                onProgressUpdate,
            });

            await waitForMedia(elementToRender);
            await saveElementAsImage({
                element: elementToRender,
                resolution: finalResolution,
                partIndex: i,
                totalParts: chunks.length,
                charName,
                chatName,
                format,
                imageLibrary,
                splitImage,
                userMaxImageHeight: maxImageHeight,
                bgColor,
                onProgressUpdate,
            });
        }
    } finally {
        onProgressEnd();
        remove();
    }
};

const exportNodeArrayPipeline = async (
    nodes: HTMLElement[],
    format: ImageFormat,
    charName: string,
    chatName: string,
    options: LogExportSettings,
    bgColor: string,
    resolvedAvatarUrl: string,
    resolvedBannerUrl: string
): Promise<void> => {
    const {
        imageResolution = DEFAULT_IMAGE_RESOLUTION,
        imageLibrary = 'html-to-image',
        splitImage = 'none',
        maxImageHeight = DEFAULT_MAX_IMAGE_HEIGHT,
        onProgressStart = () => {},
        onProgressUpdate = () => {},
        onProgressEnd = () => {},
        previewWidth = DEFAULT_PREVIEW_WIDTH,
        ...htmlOptions
    } = options;

    const { container, remove } = createOffscreenContainer();
    let currentRoot: Root | null = null;

    try {
        const resolutionForChunking = imageResolution === 'auto' ? 1 : imageResolution;
        const chunks = partitionNodesIntoChunks(
            nodes,
            splitImage,
            maxImageHeight,
            resolutionForChunking,
            previewWidth
        );

        onProgressStart('이미지 생성 중...', chunks.length);
        await delay(UI_TRANSITION_DELAY_MS);

        for (let i = 0; i < chunks.length; i++) {
            const chunk = chunks[i];
            const chunkNodes = chunk.nodes;

            onProgressUpdate({
                current: i + 1,
                message: `[${i + 1}/${chunks.length}] 컴포넌트 렌더링 중...`,
            });
            await delay(UI_TRANSITION_DELAY_MS);

            const globalSettings = await loadGlobalSettings();
            const props = buildLogContainerProps({
                chunkNodes,
                charName,
                chatName,
                resolvedAvatarUrl,
                resolvedBannerUrl,
                globalSettings,
                htmlOptions,
            });

            const { root, element: elementToRender } = await mountOffscreenLogContainer(container, props);
            currentRoot = root;

            if (!elementToRender) {
                currentRoot.unmount();
                currentRoot = null;
                continue;
            }

            const finalResolution = await resolveEffectiveResolution({
                imageResolutionSetting: imageResolution,
                elementHeight: elementToRender.offsetHeight,
                chunkIndex: i,
                totalChunks: chunks.length,
                onProgressUpdate,
            });

            await waitForMedia(elementToRender);
            await saveElementAsImage({
                element: elementToRender,
                resolution: finalResolution,
                partIndex: i,
                totalParts: chunks.length,
                charName,
                chatName,
                format,
                imageLibrary,
                splitImage,
                userMaxImageHeight: maxImageHeight,
                bgColor,
                onProgressUpdate,
            });

            currentRoot.unmount();
            currentRoot = null;
            container.innerHTML = '';
        }
    } catch (error) {
        console.error('Error preparing images:', error);
        message.error('이미지 준비 중 오류가 발생했습니다.');
    } finally {
        if (currentRoot) {
            try {
                currentRoot.unmount();
            } catch (e) {
                console.error('Failed to unmount root in finally:', e);
            }
        }
        onProgressEnd();
        remove();
    }
};

/**
 * Saves chat log nodes or a rendered DOM element as image file(s).
 * Supports single element export, chunked component rendering, auto-scaling, and binary stitching.
 *
 * @param nodes Single HTMLElement or array of message HTMLElements.
 * @param format Image format ('png', 'jpeg', or 'webp').
 * @param charName Character name for filename generation.
 * @param chatName Chat title for filename generation.
 * @param options Export and styling configuration options.
 * @param backgroundColor Optional canvas background fill color.
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
        const { onProgressStart = () => {} } = options;
        const bgColor = backgroundColor || DEFAULT_BACKGROUND_COLOR;

        onProgressStart('분할 이미지 계산 중...', 1);
        await delay(UI_TRANSITION_DELAY_MS);

        if (!Array.isArray(nodes)) {
            await exportSingleElementPipeline(nodes, format, charName, chatName, options, bgColor);
            return;
        }

        const resolvedAvatarUrl = options.charAvatarUrl ? await imageUrlToBlob(options.charAvatarUrl) : '';
        const resolvedBannerUrl = options.headerBannerUrl ? await imageUrlToBlob(options.headerBannerUrl) : '';

        await exportNodeArrayPipeline(
            nodes,
            format,
            charName,
            chatName,
            options,
            bgColor,
            resolvedAvatarUrl,
            resolvedBannerUrl
        );
    } catch (e) {
        console.error('Error in saveAsImage:', e);
    }
};

// ============================================================================
// Media ZIP Export Orchestration
// ============================================================================

/**
 * Detects the file extension from a media URL or hex-encoded filename part.
 */
function detectMediaFileExtension(url: string, isVideo: boolean): string {
    const urlPath = url.split(/[?#]/)[0] ?? '';
    const filenamePart = urlPath.substring(urlPath.lastIndexOf('/') + 1);

    // 1. Check for hex-encoded extension (e.g. "...2e706e67" where "2e" is ASCII for '.')
    const hexDotIndex = filenamePart.lastIndexOf('2e');
    if (hexDotIndex > 0) {
        try {
            const hexExt = filenamePart.substring(hexDotIndex + 2);
            const decodedExt = hexToString(hexExt);
            if (HEX_EXTENSION_REGEX.test(decodedExt)) {
                return decodedExt;
            }
        } catch (e) {
            console.warn('[Log Exporter] Failed to decode hex extension:', e);
        }
    }

    // 2. Check standard dot extension in URL path
    const lastDotIndex = urlPath.lastIndexOf('.');
    if (lastDotIndex !== -1 && urlPath.length - lastDotIndex <= 6) {
        return urlPath.substring(lastDotIndex + 1).toLowerCase();
    }

    // 3. Fallback default based on element type
    console.error(`[Log Exporter] Could not find extension from URL, using default. URL: ${url}`);
    return isVideo ? 'mp4' : 'png';
}

/**
 * Checks whether a media URL or Blob represents WebM video.
 */
function isWebmMedia(url: string, blob: Blob): boolean {
    const urlLower = url.toLowerCase();
    const isWebMFromUrl = urlLower.includes('.webm') || urlLower.includes('2e7765626d');
    const isWebMFromMime = blob.type.includes('webm');
    return isWebMFromUrl || isWebMFromMime;
}

/**
 * Extracts the media source URL and media type from an image or video DOM element.
 */
function extractMediaSource(element: Element): { src: string; isVideo: boolean } | null {
    if (element instanceof HTMLVideoElement || element.tagName === 'VIDEO') {
        const videoEl = element as HTMLVideoElement;
        const sourceEl = videoEl.querySelector('source');
        const src = sourceEl?.src || videoEl.src;
        return src ? { src, isVideo: true } : null;
    }

    if (element instanceof HTMLImageElement || element.tagName === 'IMG') {
        const imgEl = element as HTMLImageElement;
        return imgEl.src ? { src: imgEl.src, isVideo: false } : null;
    }

    return null;
}

/**
 * Exports all images, videos, and avatars in a chat log as a zipped media archive.
 *
 * @param nodes Array of message DOM nodes to inspect for media.
 * @param charInfo Character and chat metadata.
 * @param sequentialNaming If true, extracts media sequentially from arca-formatted HTML.
 * @param showAvatar If true, includes character avatars in the archive.
 * @param convertWebM If true, converts WebM video assets to animated WebP format.
 */
export const downloadImagesAsZip = async (
    nodes: Element[],
    charInfo: CharInfo,
    sequentialNaming = false,
    showAvatar = true,
    convertWebM = false
): Promise<void> => {
    console.log('[Log Exporter] downloadImagesAsZip: Media ZIP download started');
    try {
        const zip = new JSZip();
        const mediaPromises: Promise<void>[] = [];
        let mediaCounter = 0;
        const addedUrls = new Set<string>();

        const addMediaToZip = (element: Element) => {
            const mediaSource = extractMediaSource(element);
            if (!mediaSource) return;

            const { src, isVideo } = mediaSource;

            if (!src || src.startsWith('data:')) return;
            if (!sequentialNaming && addedUrls.has(src)) return;
            addedUrls.add(src);

            mediaCounter++;
            const baseFilename = `media_${String(mediaCounter).padStart(3, '0')}`;

            mediaPromises.push(
                fetchToBlobNative(src)
                    .then(async (blob) => {
                        if (convertWebM && isVideo && isWebmMedia(src, blob)) {
                            console.log(`[Log Exporter] WebM file detected, converting to WebP: ${baseFilename}`);
                            try {
                                const file = new File([blob], 'video.webm', { type: 'video/webm' });
                                const webpBlob = await convertWebMToAnimatedWebP(file, null, null, 80);
                                zip.file(`${baseFilename}.webp`, webpBlob);
                                return;
                            } catch (e) {
                                console.error('[Log Exporter] WebM conversion failed, saving original:', e);
                            }
                        }

                        const extension = detectMediaFileExtension(src, isVideo);
                        const filename = `${baseFilename}.${extension}`;
                        zip.file(filename, blob);
                    })
                    .catch((e) => console.warn(`Failed to process/compress media: ${src}`, e))
            );
        };

        const globalSettings = await loadGlobalSettings();

        if (sequentialNaming) {
            const baseHtml = await getLogHtml({
                nodes,
                charInfo,
                selectedThemeKey: 'basic',
                selectedColorKey: 'dark',
                showAvatar,
                isForArca: true,
                embedImagesAsBlob: false,
                globalSettings,
            });
            const tempDiv = document.createElement('div');
            tempDiv.innerHTML = baseHtml;
            tempDiv.querySelectorAll('img, video').forEach(addMediaToZip);
        } else {
            const html = await getLogHtml({
                nodes,
                charInfo,
                selectedThemeKey: 'basic',
                selectedColorKey: 'dark',
                showAvatar,
                isForArca: false,
                embedImagesAsBlob: false,
                globalSettings,
            });
            const tempDiv = document.createElement('div');
            tempDiv.innerHTML = html;

            if (showAvatar) {
                const avatarMap = await collectCharacterAvatars(
                    Array.from(tempDiv.children),
                    charInfo.name,
                    false,
                    globalSettings
                );
                for (const avatarUrl of avatarMap.values()) {
                    const fakeImg = document.createElement('img');
                    fakeImg.src = avatarUrl;
                    addMediaToZip(fakeImg);
                }
            }
            tempDiv.querySelectorAll('img, video').forEach(addMediaToZip);
        }

        if (mediaPromises.length === 0) {
            message.warning('다운로드할 이미지나 비디오가 로그에 없습니다.');
            return;
        }

        await Promise.all(mediaPromises);
        const content = await zip.generateAsync({ type: 'blob' });
        const safeCharName = sanitizeFilename(charInfo.name);
        const safeChatName = sanitizeFilename(charInfo.chatName);
        const zipFilename = `Risu_Log_Media_${safeCharName}_${safeChatName}${sequentialNaming ? '_Arca' : ''}.zip`;

        await downloadBlob(content, zipFilename);
    } catch (error) {
        console.error('[Log Exporter] Error creating ZIP file:', error);
        message.error('미디어 ZIP 파일 생성 중 오류가 발생했습니다.');
    }
};
