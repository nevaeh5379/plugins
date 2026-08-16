import { toBlob as htmlToImageToBlob } from 'html-to-image';
import domtoimage from 'dom-to-image-more';
import { snapdom, type SnapdomOptions } from '@zumer/snapdom';
import { loadImageBlobToCanvas, canvasToBlob } from './imageUtils';

/** Supported screenshot engine libraries */
export type ImageLibrary = 'snapdom' | 'dom-to-image' | 'html-to-image';

/** Supported export image formats */
export type ImageFormat = 'png' | 'jpeg' | 'webp';

/** Common dimension and resolution options for capturing DOM elements */
export interface CaptureOptions {
    pixelRatio: number;
    width: number;
    height: number;
}

/** Default quality setting for JPEG conversion (0.0 to 1.0) */
const DEFAULT_JPEG_QUALITY = 0.95;

/**
 * 1x1 transparent PNG used as html-to-image's `imagePlaceholder`.
 * Without it, a failed image fetch leaves an empty src on the cloned <img>,
 * which fires an error event and rejects the whole capture under the
 * plugin iframe CSP (connect-src 'none').
 */
const TRANSPARENT_PIXEL_PLACEHOLDER =
    'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==';

/** Delay (ms) to allow the browser to register download triggers before resolving */
const DOWNLOAD_CLEANUP_DELAY_MS = 100;

/**
 * Converts any image Blob into WebP format via HTMLCanvasElement.
 *
 * @param pngBlob - Source image blob (typically PNG).
 * @returns A Promise resolving to the WebP image Blob.
 */
export const convertBlobToWebP = async (pngBlob: Blob): Promise<Blob> => {
    const canvas = await loadImageBlobToCanvas(pngBlob);
    return canvasToBlob(canvas, 'image/webp');
};

/**
 * Converts a PNG Blob into a high-quality JPEG Blob without alpha transparency.
 *
 * @param pngBlob - Source PNG image blob.
 * @param quality - Optional JPEG quality (0.0 to 1.0), defaults to 0.95.
 * @returns A Promise resolving to the JPEG image Blob.
 */
export const convertPngToJpeg = async (
    pngBlob: Blob,
    quality = DEFAULT_JPEG_QUALITY
): Promise<Blob> => {
    const canvas = await loadImageBlobToCanvas(pngBlob, {
        alpha: false,
        willReadFrequently: false,
    });
    const ctx = canvas.getContext('2d');
    if (!ctx) {
        throw new Error('Failed to get 2D rendering context from canvas');
    }
    ctx.imageSmoothingEnabled = false;
    return canvasToBlob(canvas, 'image/jpeg', quality);
};

/**
 * Captures an element using `@zumer/snapdom`.
 */
async function captureWithSnapdom(
    element: HTMLElement,
    options: CaptureOptions,
    captureFormat: ImageFormat,
    bgColor: string
): Promise<Blob> {
    const snapdomOptions: SnapdomOptions = {
        scale: options.pixelRatio,
        width: options.width,
        height: options.height,
        type: captureFormat === 'jpeg' ? 'jpeg' : captureFormat,
        backgroundColor: bgColor,
    };

    const blob = await snapdom.toBlob(element, snapdomOptions);
    if (!blob) {
        throw new Error(`Failed to capture element using snapdom (${captureFormat})`);
    }
    return blob;
}

/**
 * Captures an element using `dom-to-image-more`.
 */
async function captureWithDomToImage(
    element: HTMLElement,
    options: CaptureOptions,
    captureFormat: ImageFormat,
    bgColor: string
): Promise<Blob> {
    const baseOptions = {
        pixelRatio: options.pixelRatio,
        width: options.width,
        height: options.height,
        bgcolor: bgColor,
        copyDefaultStyles: false,
    };

    if (captureFormat === 'png') {
        const blob = await domtoimage.toBlob(element, baseOptions);
        if (!blob) throw new Error('Failed to capture PNG using dom-to-image');
        return blob;
    }

    if (captureFormat === 'jpeg') {
        const blob = await domtoimage.toBlob(element, { ...baseOptions, quality: 1.0 });
        if (!blob) throw new Error('Failed to capture JPEG using dom-to-image');
        return blob;
    }

    // WebP: Capture as PNG first, then convert to WebP
    const pngBlob = await domtoimage.toBlob(element, baseOptions);
    if (!pngBlob) {
        throw new Error('Failed to capture intermediate PNG for WebP conversion using dom-to-image');
    }
    return convertBlobToWebP(pngBlob);
}

/**
 * Captures an element using `html-to-image`.
 */
async function captureWithHtmlToImage(
    element: HTMLElement,
    options: CaptureOptions,
    captureFormat: ImageFormat,
    bgColor: string
): Promise<Blob> {
    const baseOptions = {
        pixelRatio: options.pixelRatio,
        width: options.width,
        height: options.height,
        backgroundColor: bgColor,
        imagePlaceholder: TRANSPARENT_PIXEL_PLACEHOLDER,
    };

    if (captureFormat === 'png') {
        const blob = await htmlToImageToBlob(element, baseOptions);
        if (!blob) throw new Error('Failed to capture PNG using html-to-image');
        return blob;
    }

    if (captureFormat === 'jpeg') {
        const blob = await htmlToImageToBlob(element, { ...baseOptions, quality: 1.0 });
        if (!blob) throw new Error('Failed to capture JPEG using html-to-image');
        return blob;
    }

    // WebP: Capture as PNG first, then convert to WebP
    const pngBlob = await htmlToImageToBlob(element, baseOptions);
    if (!pngBlob) {
        throw new Error('Failed to capture intermediate PNG for WebP conversion using html-to-image');
    }
    return convertBlobToWebP(pngBlob);
}

/**
 * Dispatches capture execution to the designated library engine.
 */
async function executeCapture(
    library: ImageLibrary,
    element: HTMLElement,
    options: CaptureOptions,
    captureFormat: ImageFormat,
    bgColor: string
): Promise<Blob> {
    switch (library) {
        case 'snapdom':
            return captureWithSnapdom(element, options, captureFormat, bgColor);
        case 'dom-to-image':
            return captureWithDomToImage(element, options, captureFormat, bgColor);
        case 'html-to-image':
            return captureWithHtmlToImage(element, options, captureFormat, bgColor);
        default: {
            const exhaustiveCheck: never = library;
            throw new Error(`Unsupported image capture library: ${String(exhaustiveCheck)}`);
        }
    }
}

/**
 * Captures an HTML element into an image Blob using the specified library engine and format.
 *
 * Special WebP Handling:
 * - When `preserveWebpAsset` is true and `format === 'webp'`, the element is captured as PNG
 *   so that downstream binary stitching can assemble the chunks before final WebP encoding.
 * - When `preserveWebpAsset` is false, it directly produces a WebP Blob.
 *
 * @param element - The DOM element to capture.
 * @param format - Desired target format ('png', 'jpeg', or 'webp').
 * @param imageLibrary - The underlying capture library to use.
 * @param bgColor - Background color fill.
 * @param resolution - Pixel scale multiplier / resolution.
 * @param preserveWebpAsset - If true, retains intermediate PNG format for deferred WebP conversion.
 * @returns A Promise resolving to the captured image Blob.
 */
export async function captureElementToBlob(
    element: HTMLElement,
    format: ImageFormat,
    imageLibrary: ImageLibrary,
    bgColor: string,
    resolution: number,
    preserveWebpAsset = false
): Promise<Blob> {
    const commonOptions: CaptureOptions = {
        pixelRatio: resolution,
        width: element.offsetWidth,
        height: element.offsetHeight,
    };

    // When preserveWebpAsset is true, capture intermediate PNG for later merging
    const captureFormat: ImageFormat = preserveWebpAsset && format === 'webp' ? 'png' : format;

    const blob = await executeCapture(imageLibrary, element, commonOptions, captureFormat, bgColor);

    // If a library returned a PNG blob while JPEG was requested, perform lossless canvas conversion
    if (blob.type === 'image/png' && format === 'jpeg') {
        return convertPngToJpeg(blob);
    }

    return blob;
}

/**
 * Creates an isolated, clipped section wrapper for chunk-based rendering of long elements.
 * Clones the element and positions it with a negative top offset to frame the desired vertical slice.
 *
 * @param element - Source element being chunk-rendered.
 * @param startY - Vertical starting position (px) of the slice.
 * @param sectionHeight - Height (px) of the slice.
 * @param totalWidth - Total width (px) of the wrapper.
 * @param bgColor - Background color of the slice viewport.
 * @returns A configured wrapper DOM element containing the positioned clone.
 */
export function createSectionWrapper(
    element: HTMLElement,
    startY: number,
    sectionHeight: number,
    totalWidth: number,
    bgColor: string
): HTMLElement {
    const wrapper = document.createElement('div');
    wrapper.style.position = 'relative';
    wrapper.style.width = `${totalWidth}px`;
    wrapper.style.height = `${sectionHeight}px`;
    wrapper.style.overflow = 'hidden';
    wrapper.style.backgroundColor = bgColor;

    const clone = element.cloneNode(true) as HTMLElement;
    clone.style.position = 'absolute';
    clone.style.top = `${-startY}px`;
    clone.style.left = '0';
    wrapper.appendChild(clone);

    return wrapper;
}

/**
 * Temporarily mounts a wrapper element into document.body during execution of an async callback,
 * guaranteeing clean unmounting and removal in a `finally` block even on failure.
 *
 * @param wrapper - The DOM element to temporarily mount.
 * @param fn - The async task to execute while the wrapper is attached to the DOM.
 * @returns The result of `fn()`.
 */
export async function withTempWrapper<T>(
    wrapper: HTMLElement,
    fn: () => Promise<T>
): Promise<T> {
    document.body.appendChild(wrapper);
    try {
        return await fn();
    } finally {
        if (wrapper.parentElement) {
            wrapper.parentElement.removeChild(wrapper);
        }
    }
}

/**
 * Triggers a client-side file download for a given Blob.
 * Automatically cleans up the object URL and temporary DOM anchor after dispatching.
 *
 * @param blob - The Blob to download.
 * @param filename - The filename to save as.
 * @returns A Promise that resolves shortly after the download is initiated.
 */
export function downloadBlob(blob: Blob, filename: string): Promise<void> {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    return new Promise(resolve => setTimeout(resolve, DOWNLOAD_CLEANUP_DELAY_MS));
}
