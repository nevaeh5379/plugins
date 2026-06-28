import { toBlob as htmlToImageToBlob } from 'html-to-image';
import domtoimage from 'dom-to-image-more';
import { snapdom, type SnapdomOptions } from '@zumer/snapdom';
import { loadImageBlobToCanvas, canvasToBlob } from './imageUtils';

export type ImageLibrary = 'snapdom' | 'dom-to-image' | 'html-to-image';
export type ImageFormat = 'png' | 'jpeg' | 'webp';

export interface CaptureOptions {
    pixelRatio: number;
    width: number;
    height: number;
}

/**
 * Blob을 WebP로 변환합니다.
 */
export const convertBlobToWebP = async (pngBlob: Blob): Promise<Blob> => {
    const canvas = await loadImageBlobToCanvas(pngBlob);
    return canvasToBlob(canvas, 'image/webp');
};

/**
 * PNG Blob을 JPEG로 변환합니다.
 */
export const convertPngToJpeg = async (pngBlob: Blob): Promise<Blob> => {
    const canvas = await loadImageBlobToCanvas(pngBlob, { alpha: false, willReadFrequently: false });
    const ctx = canvas.getContext('2d')!;
    ctx.imageSmoothingEnabled = false;
    return canvasToBlob(canvas, 'image/jpeg', 0.95);
};

/**
 * 지정된 이미지 라이브러리를 사용하여 요소의 Blob을 캡처합니다.
 * format이 'webp'인 경우:
 *   - preserveWebpAsset=true  → PNG로 캡처 (후속 병합에서 WebP 변환)
 *   - preserveWebpAsset=false → PNG 캡처 후 WebP로 변환
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

    // WebP는 PNG로 캡처 후 변환 (이미지 에셋 보존)
    const captureFormat = preserveWebpAsset && format === 'webp' ? 'png' : format;

    let blob: Blob | null = null;

    if (imageLibrary === 'snapdom') {
        const snapdomOptions: SnapdomOptions = {
            scale: resolution,
            width: commonOptions.width,
            height: commonOptions.height,
            type: captureFormat === 'jpeg' ? 'jpeg' : captureFormat,
            backgroundColor: bgColor,
        };
        blob = await snapdom.toBlob(element, snapdomOptions);
    } else if (imageLibrary === 'dom-to-image') {
        const libOptions = { ...commonOptions, bgcolor: bgColor, copyDefaultStyles: false };
        if (captureFormat === 'png') {
            blob = await domtoimage.toBlob(element, libOptions);
        } else if (captureFormat === 'jpeg') {
            blob = await domtoimage.toBlob(element, { ...libOptions, quality: 1.0 });
        } else {
            // webp: PNG로 캡처 후 변환
            const pngBlob = await domtoimage.toBlob(element, libOptions);
            if (!pngBlob) throw new Error('Failed to capture PNG');
            blob = await convertBlobToWebP(pngBlob);
        }
    } else {
        // html-to-image
        const libOptions = { ...commonOptions, backgroundColor: bgColor };
        if (captureFormat === 'png') {
            blob = await htmlToImageToBlob(element, libOptions);
        } else if (captureFormat === 'jpeg') {
            blob = await htmlToImageToBlob(element, { ...libOptions, quality: 1.0 });
        } else {
            // webp: PNG로 캡처 후 변환
            const pngBlob = await htmlToImageToBlob(element, libOptions);
            if (!pngBlob) throw new Error('Failed to capture PNG');
            blob = await convertBlobToWebP(pngBlob);
        }
    }

    if (!blob) throw new Error('Failed to capture element');

    // dom-to-image와 html-to-image는 항상 PNG를 생성하므로
    // JPEG 요청 시에만 포맷 변환 (WebP는 preserveWebpAsset이면 병합 후 변환)
    if (blob.type === 'image/png' && format === 'jpeg') {
        return convertPngToJpeg(blob);
    }

    return blob;
}

/**
 * 요소의 일부를 캡처하기 위한 임시 wrapper를 생성합니다.
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
 * 생성된 wrapper를 DOM에 추가하고, 작업 후 제거합니다.
 */
export async function withTempWrapper<T>(
    wrapper: HTMLElement,
    fn: () => Promise<T>
): Promise<T> {
    document.body.appendChild(wrapper);
    try {
        return await fn();
    } finally {
        document.body.removeChild(wrapper);
    }
}

/**
 * Blob을 파일로 다운로드합니다.
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
    return new Promise(resolve => setTimeout(resolve, 100));
}
