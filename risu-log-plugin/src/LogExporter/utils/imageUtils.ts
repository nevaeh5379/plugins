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

export async function fetchToBlobNative(url: string): Promise<Blob> {
  const isTauriAsset = url.startsWith('asset://') || url.includes('asset.localhost');
  if (isTauriAsset) {
    try {
      const decoded = decodeURIComponent(url);
      let loc = '';
      const assetsIdx = decoded.indexOf('assets/');
      if (assetsIdx !== -1) {
        loc = decoded.substring(assetsIdx);
      } else {
        loc = decoded.replace(/^(asset:\/\/localhost\/|https:\/\/asset\.localhost\/|http:\/\/asset\.localhost\/|asset:\/\/)/, '');
      }
      console.log('[log plugin] Tauri asset URL detected. Extracted loc:', loc);
      const data = await Risuai.readImage(loc);
      if (data) {
        let mimeType = 'image/png';
        if (loc.endsWith('.jpg') || loc.endsWith('.jpeg')) {
          mimeType = 'image/jpeg';
        } else if (loc.endsWith('.webp')) {
          mimeType = 'image/webp';
        } else if (loc.endsWith('.gif')) {
          mimeType = 'image/gif';
        }
        return new Blob([data], { type: mimeType });
      }
      throw new Error(`readImage returned empty data for Tauri asset: ${loc}`);
    } catch (e) {
      console.error('[log plugin] Failed to readImage for Tauri asset:', e);
      throw e;
    }
  }

  const swImgMatch = url.match(/\/sw\/img\/([0-9a-fA-F]+)/);
  if (swImgMatch && swImgMatch[1]) {
    try {
      const hex = swImgMatch[1];
      let loc = '';
      for (let i = 0; i < hex.length; i += 2) {
        loc += String.fromCharCode(parseInt(hex.substr(i, 2), 16));
      }
      console.log('[log plugin] SW image URL detected. Decoding key:', loc);
      const data = await Risuai.readImage(loc);
      if (data) {
        let mimeType = 'image/png';
        if (loc.endsWith('.jpg') || loc.endsWith('.jpeg')) {
          mimeType = 'image/jpeg';
        } else if (loc.endsWith('.webp')) {
          mimeType = 'image/webp';
        } else if (loc.endsWith('.gif')) {
          mimeType = 'image/gif';
        }
        return new Blob([data], { type: mimeType });
      }
      throw new Error(`readImage returned empty data for ${loc}`);
    } catch (e) {
      console.error('[log plugin] Failed to readImage for SW URL:', e);
      throw e;
    }
  }

  let parentHost = '';
  try {
    if (document.referrer) {
      parentHost = new URL(document.referrer).host;
    }
  } catch (e) {
    /* ignore */
  }

  const isRelative = url.startsWith('/') || (!url.startsWith('http://') && !url.startsWith('https://'));
  const isSameOrigin = isRelative || (parentHost && url.includes(parentHost));

  if (isSameOrigin) {
    try {
      console.log('[log plugin] Same-origin URL detected, fetching via risuFetch:', url);
      const res = await ((Risuai as unknown) as { risuFetch: (url: string, options: Record<string, unknown>) => Promise<{ ok: boolean; data: unknown; headers?: Record<string, string>; status?: number }> }).risuFetch(url, {
        method: 'GET',
        plainFetchForce: true,
        rawResponse: true
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

  const res = await Risuai.nativeFetch(url, { method: 'GET' } as Record<string, unknown>)
  if (!res.ok) throw new Error(`nativeFetch failed: ${res.status} ${res.statusText} for ${url}`)
  return await res.blob()
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