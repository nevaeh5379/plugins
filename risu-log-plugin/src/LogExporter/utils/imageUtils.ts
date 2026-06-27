// imageUtils.ts — v3.0 기반
// iframe CSP: connect-src 'none' 으로 인해 iframe 내부 fetch가 완전 차단됩니다.
// 따라서 이미지를 blob URL이 아닌 data URL(base64)로 변환하여 <img src="data:...">로
// 사용해야 합니다. data URL은 fetch 없이 로드 가능하고 CSP img-src data:에 허용됩니다.
//
// 변환 흐름: 원본 URL → Risuai.nativeFetch(메인 측 동일 출처, CORS 회피) → blob → data URL
// 이렇게 하면 html-to-image / html2canvas가 캡처 시 fetch/CORS 이슈 없이 동작합니다.

const dataUrlCache = new Map<string, string>()

// Blob → data URL (base64)
function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result as string)
    reader.onerror = () => reject(new Error('FileReader failed'))
    reader.readAsDataURL(blob)
  })
}

/**
 * 헥스 문자열을 일반 문자열로 디코딩합니다.
 */
export function hexToString(hex: string): string {
    let str = '';
    for (let i = 0; i < hex.length; i += 2) {
        str += String.fromCharCode(parseInt(hex.substr(i, 2), 16));
    }
    return str;
}

/**
 * 파일 확장자로부터 MIME 타입을 감지합니다.
 */
export function detectMimeTypeFromPath(path: string): string {
    if (path.endsWith('.jpg') || path.endsWith('.jpeg')) return 'image/jpeg';
    if (path.endsWith('.webp')) return 'image/webp';
    if (path.endsWith('.gif')) return 'image/gif';
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
    return new Blob([data], { type: mimeType });
}

/**
 * Tauri asset URL에서 실제 asset 위치를 추출합니다.
 */
export function extractTauriAssetLocation(url: string): string | null {
    const decoded = decodeURIComponent(url);
    const assetsIdx = decoded.indexOf('assets/');
    if (assetsIdx !== -1) {
        return decoded.substring(assetsIdx);
    }
    return decoded.replace(
        /^(asset:\/\/localhost\/|https:\/\/asset\.localhost\/|http:\/\/asset\.localhost\/|asset:\/\/)/,
        ''
    ) || null;
}

/**
 * SW 이미지 URL에서 asset 위치를 추출합니다.
 */
export function extractSwImageLocation(url: string): string | null {
    const match = url.match(/\/sw\/img\/([0-9a-fA-F]+)/);
    if (!match || !match[1]) return null;
    return hexToString(match[1]);
}

/**
 * 이미지 URL을 Blob으로 변환합니다.
 * Tauri asset, SW image, same-origin, 외부 URL을 모두 지원합니다.
 */
export async function fetchToBlobNative(url: string): Promise<Blob> {
    // 1. Tauri asset URL 처리
    const isTauriAsset = url.startsWith('asset://') || url.includes('asset.localhost');
    if (isTauriAsset) {
        const loc = extractTauriAssetLocation(url);
        if (loc) {
            console.log('[log plugin] Tauri asset URL detected. Extracted loc:', loc);
            return readAssetAsBlob(loc);
        }
        throw new Error(`Failed to extract Tauri asset location: ${url}`);
    }

    // 2. SW 이미지 URL 처리
    const swLoc = extractSwImageLocation(url);
    if (swLoc) {
        console.log('[log plugin] SW image URL detected. Decoding key:', swLoc);
        return readAssetAsBlob(swLoc);
    }

    // 3. Same-origin URL 처리
    let parentHost = '';
    try {
        if (document.referrer) {
            parentHost = new URL(document.referrer).host;
        }
    } catch (e) {
        console.warn('[log plugin] Failed to parse referrer URL for same-origin check:', e);
    }

    const isRelative = url.startsWith('/') || (!url.startsWith('http://') && !url.startsWith('https://'));
    const isSameOrigin = isRelative || (parentHost && url.includes(parentHost));

    if (isSameOrigin) {
        try {
            console.log('[log plugin] Same-origin URL detected, fetching via risuFetch:', url);
            const res = await ((Risuai as unknown) as {
                risuFetch: (url: string, options: Record<string, unknown>) => Promise<{
                    ok: boolean;
                    data: unknown;
                    headers?: Record<string, string>;
                    status?: number;
                }>;
            }).risuFetch(url, {
                method: 'GET',
                plainFetchForce: true,
                rawResponse: true,
            } as Record<string, unknown>);
            if (res && res.ok && res.data) {
                const mimeType = res.headers?.['content-type'] || 'image/png';
                return new Blob([res.data as BlobPart], { type: mimeType });
            }
            throw new Error(`risuFetch failed with status ${res?.status}`);
        } catch (e) {
            console.warn('[log plugin] Same-origin risuFetch failed, falling back to nativeFetch:', e);
        }
    }

    // 4. 외부 URL — nativeFetch 사용
    const res = await Risuai.nativeFetch(url, { method: 'GET' } as Record<string, unknown>);
    if (!res.ok) throw new Error(`nativeFetch failed: ${res.status} ${res.statusText} for ${url}`);
    return await res.blob();
}

/**
 * 이미지 URL을 data URL(base64)로 변환합니다.
 * iframe CSP connect-src 'none' 환경에서 blob URL은 fetch가 필요하지만
 * data URL은 fetch 없이 <img>로 로드 가능하여 캡처 라이브러리가 정상 동작합니다.
 *
 * @returns data URL 문자열. 실패 시 원본 URL 반환.
 */
export const imageUrlToBlob = async (url: string): Promise<string> => {
  if (!url || url.startsWith('data:') || url.startsWith('blob:')) {
    return url
  }
  if (dataUrlCache.has(url)) {
    return dataUrlCache.get(url)!
  }

  try {
    const blob = await fetchToBlobNative(url)
    const dataUrl = await blobToDataUrl(blob)
    dataUrlCache.set(url, dataUrl)
    return dataUrl
  } catch (error) {
    console.error('[log plugin] imageUrlToBlob failed:', url, error)
    throw error;
  }
}

export const clearBlobUrlCache = () => {
  // data URL은 revoke 불필요. 캐시만 비움.
  dataUrlCache.clear()
  console.log('[log plugin] Data URL cache cleared.')
}
