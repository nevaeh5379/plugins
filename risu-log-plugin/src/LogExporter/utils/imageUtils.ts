/**
 * imageUtils.ts — v3.0 기반 이미지 유틸리티
 *
 * iframe CSP: connect-src 'none' 으로 인해 iframe 내부 fetch가 완전 차단됩니다.
 * 따라서 이미지를 blob URL이 아닌 data URL(base64)로 변환하여 <img src="data:...">로
 * 사용해야 합니다. data URL은 fetch 없이 로드 가능하고 CSP img-src data:에 허용됩니다.
 *
 * 변환 흐름: 원본 URL → Risuai.nativeFetch / risuFetch / readImage → blob → data URL
 * 이를 통해 html-to-image / html2canvas가 캡처 시 fetch/CORS 이슈 없이 동작합니다.
 */

// ==========================================
// Types & API Interfaces
// ==========================================

interface RisuFetchResponse {
    ok: boolean;
    data?: unknown;
    headers?: Record<string, string>;
    status?: number;
}

interface RisuaiExtendedAPI {
    risuFetch?: (
        url: string,
        options: Record<string, unknown>
    ) => Promise<RisuFetchResponse>;
}

// ==========================================
// Constants & Caches
// ==========================================

const MIME_TYPE_MAP: Readonly<Record<string, string>> = {
    jpg: 'image/jpeg',
    jpeg: 'image/jpeg',
    png: 'image/png',
    webp: 'image/webp',
    gif: 'image/gif',
    svg: 'image/svg+xml',
    avif: 'image/avif',
    bmp: 'image/bmp',
    ico: 'image/x-icon',
};

const TAURI_PREFIX_REGEX = /^(?:asset:\/\/localhost\/|https?:\/\/asset\.localhost\/|asset:\/\/)/i;
const SW_IMAGE_REGEX = /\/sw\/img\/([0-9a-fA-F]+)/;
const BG_URL_QUOT_REGEX = /url\(&quot;([^&]+?)&quot;\)/;
const BG_URL_STANDARD_REGEX = /url\(["']?([^"')]+?)["']?\)/;

/** 변환 완료된 Data URL 캐시 (메모리 절약 및 중복 변환 방지) */
const dataUrlCache = new Map<string, string>();

/** 진행 중인 Data URL 변환 Promise 캐시 (동시 요청 중복 실행 방지) */
const inFlightDataUrlCache = new Map<string, Promise<string>>();

// ==========================================
// Helper Utilities (Internal)
// ==========================================

/**
 * URI 컴포넌트를 안전하게 디코딩합니다 (디코딩 에러 발생 시 원본 반환).
 */
function safeDecodeURIComponent(uri: string): string {
    try {
        return decodeURIComponent(uri);
    } catch {
        return uri;
    }
}

/**
 * Blob 객체를 Base64 data URL 문자열로 변환합니다.
 */
function blobToDataUrl(blob: Blob): Promise<string> {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();

        reader.onload = () => {
            if (typeof reader.result === 'string') {
                resolve(reader.result);
            } else {
                reject(new Error('FileReader result is not a string'));
            }
        };

        reader.onerror = () => {
            reject(reader.error ?? new Error('FileReader failed to read blob'));
        };

        reader.onabort = () => {
            reject(new Error('FileReader operation was aborted'));
        };

        reader.readAsDataURL(blob);
    });
}

/**
 * Data URL (base64 또는 URI 인코딩)을 Blob 객체로 변환합니다.
 */
function dataUrlToBlob(dataUrl: string): Blob {
    const commaIndex = dataUrl.indexOf(',');
    if (commaIndex < 0) {
        throw new Error('Invalid data URL: missing comma separator');
    }

    const header = dataUrl.slice(0, commaIndex);
    const encodedData = dataUrl.slice(commaIndex + 1);

    const metadata = header.startsWith('data:') ? header.slice(5) : header;
    const metadataParts = metadata.split(';');
    const mimeType = metadataParts[0]?.trim() || 'application/octet-stream';
    const isBase64 = metadataParts.some((part) => part.trim().toLowerCase() === 'base64');

    if (!isBase64) {
        return new Blob([decodeURIComponent(encodedData)], { type: mimeType });
    }

    const binaryString = atob(encodedData.replace(/\s/g, ''));
    const bytes = new Uint8Array(binaryString.length);
    for (let index = 0; index < binaryString.length; index++) {
        bytes[index] = binaryString.charCodeAt(index);
    }

    return new Blob([bytes], { type: mimeType });
}

/**
 * 부모 창(Referrer)의 호스트명을 가져옵니다.
 */
function getParentReferrerHost(): string {
    if (typeof document === 'undefined' || !document.referrer) {
        return '';
    }
    try {
        return new URL(document.referrer).host;
    } catch (e) {
        console.warn('[log plugin] Failed to parse referrer URL for same-origin check:', e);
        return '';
    }
}

/**
 * 주어진 URL이 현재 환경과 Same-origin인지 확인합니다.
 */
function isSameOriginUrl(url: string): boolean {
    const isRelative = url.startsWith('/') || (!url.startsWith('http://') && !url.startsWith('https://'));
    if (isRelative) {
        return true;
    }
    const parentHost = getParentReferrerHost();
    return Boolean(parentHost && url.includes(parentHost));
}

/**
 * Same-origin URL을 Risuai.risuFetch를 통해 Blob으로 가져옵니다.
 */
async function tryFetchSameOriginBlob(url: string): Promise<Blob | null> {
    const risuaiApi = Risuai as unknown as RisuaiExtendedAPI;
    if (typeof risuaiApi.risuFetch !== 'function') {
        return null;
    }

    try {
        console.log('[log plugin] Same-origin URL detected, fetching via risuFetch:', url);
        const res = await risuaiApi.risuFetch(url, {
            method: 'GET',
            plainFetchForce: true,
            rawResponse: true,
        });

        if (res?.ok && res.data) {
            const mimeType = res.headers?.['content-type'] || 'image/png';
            return new Blob([res.data as BlobPart], { type: mimeType });
        }
        throw new Error(`risuFetch failed with status ${res?.status}`);
    } catch (e) {
        console.warn('[log plugin] Same-origin risuFetch failed, falling back to nativeFetch:', e);
        return null;
    }
}

/**
 * Blob으로부터 HTMLImageElement를 비동기 로드합니다.
 * Object URL의 생성과 메모리 해제(revokeObjectURL) 수명 주기를 보장합니다.
 */
function loadImageElement(blob: Blob): Promise<HTMLImageElement> {
    return new Promise<HTMLImageElement>((resolve, reject) => {
        const objectUrl = URL.createObjectURL(blob);
        const image = new Image();

        image.onload = () => {
            URL.revokeObjectURL(objectUrl);
            resolve(image);
        };

        image.onerror = (event) => {
            URL.revokeObjectURL(objectUrl);
            reject(new Error(`Failed to load image from blob: ${String(event)}`));
        };

        image.src = objectUrl;
    });
}

// ==========================================
// Exported Core Functions
// ==========================================

/**
 * 16진수(Hex) 문자열을 일반 문자열로 디코딩합니다.
 */
export function hexToString(hex: string): string {
    let result = '';
    const cleanHex = hex.trim();
    for (let i = 0; i < cleanHex.length; i += 2) {
        const byte = parseInt(cleanHex.substring(i, i + 2), 16);
        if (!Number.isNaN(byte)) {
            result += String.fromCharCode(byte);
        }
    }
    return result;
}

/**
 * 파일 경로 또는 URL의 확장자로부터 MIME 타입을 감지합니다.
 */
export function detectMimeTypeFromPath(path: string): string {
    const cleanPath = path.split(/[?#]/)[0] ?? '';
    const extension = cleanPath.split('.').pop()?.toLowerCase();
    if (extension && extension in MIME_TYPE_MAP) {
        return MIME_TYPE_MAP[extension];
    }
    return 'image/png';
}

/**
 * Risuai.readImage를 사용하여 asset 데이터를 Blob으로 가져옵니다.
 */
export async function readAssetAsBlob(assetId: string): Promise<Blob> {
    const data = await Risuai.readImage(assetId);
    if (!data) {
        throw new Error(`readImage returned empty data for asset: ${assetId}`);
    }
    const mimeType = detectMimeTypeFromPath(assetId);
    return new Blob([data as BlobPart], { type: mimeType });
}

/**
 * Tauri asset URL에서 실제 asset 위치 경로를 추출합니다.
 */
export function extractTauriAssetLocation(url: string): string | null {
    const decoded = safeDecodeURIComponent(url);
    const assetsIndex = decoded.indexOf('assets/');
    if (assetsIndex !== -1) {
        return decoded.substring(assetsIndex);
    }
    const stripped = decoded.replace(TAURI_PREFIX_REGEX, '');
    return stripped || null;
}

/**
 * Service Worker 이미지 URL에서 hex 인코딩된 asset 위치를 추출합니다.
 */
export function extractSwImageLocation(url: string): string | null {
    const match = url.match(SW_IMAGE_REGEX);
    if (!match?.[1]) {
        return null;
    }
    return hexToString(match[1]);
}

/**
 * 다양한 형태의 이미지 URL을 Blob 객체로 변환합니다.
 * Tauri asset, Service Worker image, Same-origin URL, 외부 URL을 모두 지원합니다.
 */
export async function fetchToBlobNative(url: string): Promise<Blob> {
    // 1. 이미 Data URL인 경우
    if (url.startsWith('data:')) {
        return dataUrlToBlob(url);
    }

    // 2. 이미 Blob URL인 경우
    if (url.startsWith('blob:')) {
        const response = await fetch(url);
        if (!response.ok) {
            throw new Error(`Blob URL fetch failed: ${response.status}`);
        }
        return response.blob();
    }

    // 3. Tauri asset URL 처리
    const isTauriAsset = url.startsWith('asset://') || url.includes('asset.localhost');
    if (isTauriAsset) {
        const location = extractTauriAssetLocation(url);
        if (location) {
            console.log('[log plugin] Tauri asset URL detected. Extracted loc:', location);
            return readAssetAsBlob(location);
        }
        throw new Error(`Failed to extract Tauri asset location: ${url}`);
    }

    // 4. Service Worker 이미지 URL 처리
    const swLocation = extractSwImageLocation(url);
    if (swLocation) {
        console.log('[log plugin] SW image URL detected. Decoding key:', swLocation);
        return readAssetAsBlob(swLocation);
    }

    // 5. Same-origin URL 처리 (Risuai.risuFetch 우선 시도)
    if (isSameOriginUrl(url)) {
        const sameOriginBlob = await tryFetchSameOriginBlob(url);
        if (sameOriginBlob) {
            return sameOriginBlob;
        }
    }

    // 6. 외부 URL 또는 fallback — Risuai.nativeFetch 사용
    const res = await Risuai.nativeFetch(url, { method: 'GET' } as RequestInit);
    if (!res.ok) {
        throw new Error(`nativeFetch failed: ${res.status} ${res.statusText} for ${url}`);
    }
    return res.blob();
}

/**
 * 이미지 URL을 Data URL(base64)로 변환합니다.
 *
 * iframe CSP connect-src 'none' 환경에서 Blob URL은 추가 fetch가 필요하지만,
 * Data URL은 fetch 없이 <img> 태그로 로드 가능하여 캡처 라이브러리가 정상 동작합니다.
 * 동일 URL에 대한 동시 요청은 단일 Promise로 중복 처리를 방지합니다.
 *
 * @returns Data URL 문자열
 */
export const imageUrlToBlob = async (url: string): Promise<string> => {
    if (!url || url.startsWith('data:') || url.startsWith('blob:')) {
        return url;
    }

    const cached = dataUrlCache.get(url);
    if (cached !== undefined) {
        return cached;
    }

    const inFlight = inFlightDataUrlCache.get(url);
    if (inFlight !== undefined) {
        return inFlight;
    }

    const fetchPromise = (async () => {
        try {
            const blob = await fetchToBlobNative(url);
            const dataUrl = await blobToDataUrl(blob);
            dataUrlCache.set(url, dataUrl);
            return dataUrl;
        } catch (error) {
            console.error('[log plugin] imageUrlToBlob failed:', url, error);
            throw error;
        } finally {
            inFlightDataUrlCache.delete(url);
        }
    })();

    inFlightDataUrlCache.set(url, fetchPromise);
    return fetchPromise;
};

/**
 * 이미지 Blob을 Canvas에 로드하고 렌더링합니다.
 */
export async function loadImageBlobToCanvas(
    blob: Blob,
    contextOptions?: CanvasRenderingContext2DSettings
): Promise<HTMLCanvasElement> {
    const img = await loadImageElement(blob);

    const canvas = document.createElement('canvas');
    canvas.width = img.naturalWidth || img.width;
    canvas.height = img.naturalHeight || img.height;

    const ctx = canvas.getContext('2d', contextOptions);
    if (!ctx) {
        throw new Error('Canvas context not available');
    }

    ctx.drawImage(img, 0, 0);
    return canvas;
}

/**
 * Canvas를 지정된 포맷의 Blob으로 내보냅니다.
 */
export function canvasToBlob(
    canvas: HTMLCanvasElement,
    format: string,
    quality?: number
): Promise<Blob> {
    return new Promise<Blob>((resolve, reject) => {
        canvas.toBlob(
            (b) => {
                if (b) {
                    resolve(b);
                } else {
                    reject(new Error(`Failed to convert canvas to ${format}`));
                }
            },
            format,
            quality
        );
    });
}

/**
 * CSS background-image style 문자열에서 이미지 URL을 추출합니다.
 * `url(...)`, `url("...")`, `url('...')`, `url(&quot;...&quot;)` 모든 형식을 지원합니다.
 */
export function extractBackgroundImageUrl(styleAttr: string): string | null {
    if (!styleAttr || typeof styleAttr !== 'string') {
        return null;
    }
    const match =
        styleAttr.match(BG_URL_QUOT_REGEX) ||
        styleAttr.match(BG_URL_STANDARD_REGEX);
    return match?.[1]?.trim() ?? null;
}

/**
 * Data URL 메모리 캐시를 초기화합니다.
 */
export const clearBlobUrlCache = (): void => {
    dataUrlCache.clear();
    inFlightDataUrlCache.clear();
    console.log('[log plugin] Data URL cache cleared.');
};
