import type { ArcaImage } from '../../types';
import { convertWebMToAnimatedWebP } from '../../services/webmConverter';
import {
  canvasToBlob,
  fetchToBlobNative,
  loadImageBlobToCanvas,
} from '../utils/imageUtils';
import {
  validateArcaProxyUrl,
  type ArcaProxyConfig,
} from './arcaProxyConfigService';

const ARCA_ORIGIN = 'https://arca.live';
const ARCA_WRITE_URL = `${ARCA_ORIGIN}/b/logtest/write`;
const ARCA_UPLOAD_URL = `${ARCA_ORIGIN}/b/upload`;
const MAX_UPLOAD_SIZE = 50 * 1024 * 1024;
const SUPPORTED_ARCA_MIME_TYPES = new Set([
  'image/gif',
  'image/jpeg',
  'image/png',
  'image/webp',
  'video/mp4',
  'video/quicktime',
  'video/webm',
]);
const BROWSER_USER_AGENT = navigator.userAgent ||
  'Mozilla/5.0 AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36';

interface ArcaUploadSession {
  token: string;
}

interface NativeFetchOptions extends RequestInit {
  logFetch?: boolean;
  requestTimeoutMs?: number;
}

export interface ArcaUploadProgress {
  current: number;
  total: number;
  filename: string;
}

function getArcaErrorMessage(body: string, status: number): string {
  try {
    const parsed = JSON.parse(body) as { message?: string };
    if (parsed.message) return parsed.message;
  } catch {
    // The endpoint sometimes returns an HTML error page.
  }
  return `아카라이브가 업로드 요청을 거절했습니다. (HTTP ${status})`;
}

async function createUploadSession(): Promise<ArcaUploadSession> {
  const response = await Risuai.nativeFetch(ARCA_WRITE_URL, {
    method: 'GET',
    headers: {
      Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
      'Accept-Language': 'ko-KR,ko;q=0.9,en-US;q=0.8,en;q=0.7',
      'User-Agent': BROWSER_USER_AGENT,
    },
    logFetch: false,
    requestTimeoutMs: 30_000,
  } as NativeFetchOptions);

  const html = await response.text();
  if (!response.ok) {
    throw new Error(getArcaErrorMessage(html, response.status));
  }

  const document = new DOMParser().parseFromString(html, 'text/html');
  const token = (document.querySelector('input[name="token"]') as HTMLInputElement | null)?.value;
  if (!token) {
    throw new Error('아카라이브 글쓰기 페이지에서 업로드 토큰을 찾지 못했습니다. Cloudflare 차단 또는 페이지 변경 가능성이 있습니다.');
  }

  return { token };
}

function encodeUtf8(value: string): Uint8Array {
  return new TextEncoder().encode(value);
}

function bytesToBase64(bytes: Uint8Array): string {
  const chunkSize = 0x8000;
  let binary = '';
  for (let offset = 0; offset < bytes.length; offset += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(offset, offset + chunkSize));
  }
  return btoa(binary);
}

function concatBytes(parts: Uint8Array[]): Uint8Array {
  const result = new Uint8Array(parts.reduce((total, part) => total + part.byteLength, 0));
  let offset = 0;
  for (const part of parts) {
    result.set(part, offset);
    offset += part.byteLength;
  }
  return result;
}

function detectMediaMimeType(bytes: Uint8Array): string | null {
  if (bytes.length >= 8 &&
      bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47 &&
      bytes[4] === 0x0d && bytes[5] === 0x0a && bytes[6] === 0x1a && bytes[7] === 0x0a) {
    return 'image/png';
  }
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) {
    return 'image/jpeg';
  }
  const ascii = new TextDecoder('ascii').decode(bytes);
  if (ascii.startsWith('GIF87a') || ascii.startsWith('GIF89a')) return 'image/gif';
  if (ascii.startsWith('RIFF') && ascii.slice(8, 12) === 'WEBP') return 'image/webp';
  if (bytes.length >= 4 &&
      bytes[0] === 0x1a && bytes[1] === 0x45 && bytes[2] === 0xdf && bytes[3] === 0xa3) {
    return 'video/webm';
  }
  if (ascii.slice(4, 8) === 'ftyp') {
    const brand = ascii.slice(8, 12);
    if (brand === 'qt  ') return 'video/quicktime';
    if (brand === 'avif' || brand === 'avis') return 'image/avif';
    return 'video/mp4';
  }
  if (ascii.startsWith('BM')) return 'image/bmp';
  const textPrefix = new TextDecoder().decode(bytes).trimStart().toLowerCase();
  if (textPrefix.startsWith('<svg') || textPrefix.startsWith('<?xml')) return 'image/svg+xml';
  return null;
}

function extensionForMimeType(mimeType: string): string {
  switch (mimeType) {
    case 'image/gif': return 'gif';
    case 'image/jpeg': return 'jpg';
    case 'image/png': return 'png';
    case 'image/webp': return 'webp';
    case 'video/mp4': return 'mp4';
    case 'video/quicktime': return 'mov';
    case 'video/webm': return 'webm';
    default: return 'bin';
  }
}

async function normalizeArcaMedia(blob: Blob, filename: string): Promise<{ blob: Blob; filename: string }> {
  const prefix = new Uint8Array(await blob.slice(0, 512).arrayBuffer());
  const detectedMimeType = detectMediaMimeType(prefix);
  const declaredMimeType = blob.type.toLowerCase().split(';', 1)[0];
  const mimeType = detectedMimeType || declaredMimeType;

  if (SUPPORTED_ARCA_MIME_TYPES.has(mimeType)) {
    const normalizedBlob = blob.type === mimeType ? blob : new Blob([blob], { type: mimeType });
    const extension = extensionForMimeType(mimeType);
    return {
      blob: normalizedBlob,
      filename: filename.replace(/\.[^.]+$/, '') + `.${extension}`,
    };
  }

  const isConvertibleImage = mimeType.startsWith('image/') ||
    declaredMimeType.startsWith('image/');
  if (isConvertibleImage) {
    try {
      const canvas = await loadImageBlobToCanvas(blob);
      const webp = await canvasToBlob(canvas, 'image/webp', 0.9);
      return {
        blob: webp,
        filename: filename.replace(/\.[^.]+$/, '') + '.webp',
      };
    } catch (error) {
      throw new Error(`${filename} 이미지를 아카라이브용 WebP로 변환하지 못했습니다. (${mimeType || '알 수 없는 형식'}: ${String(error)})`);
    }
  }

  throw new Error(`${filename}의 미디어 형식을 판별하지 못했습니다. (${mimeType || 'MIME 타입 없음'})`);
}

async function createMultipartBody(
  token: string,
  filename: string,
  blob: Blob,
  boundary: string,
): Promise<Uint8Array> {
  const safeFilename = filename.replace(/["\r\n]/g, '_');
  const mimeType = blob.type || 'application/octet-stream';
  return concatBytes([
    encodeUtf8(
      `--${boundary}\r\n` +
      `Content-Disposition: form-data; name="upload"; filename="${safeFilename}"\r\n` +
      `Content-Type: ${mimeType}\r\n\r\n`,
    ),
    new Uint8Array(await blob.arrayBuffer()),
    encodeUtf8(
      `\r\n--${boundary}\r\n` +
      'Content-Disposition: form-data; name="token"\r\n\r\n' +
      `${token}\r\n` +
      `--${boundary}\r\n` +
      'Content-Disposition: form-data; name="saveExif"\r\n\r\n' +
      'false\r\n' +
      `--${boundary}\r\n` +
      'Content-Disposition: form-data; name="saveFilename"\r\n\r\n' +
      'false\r\n' +
      `--${boundary}--\r\n`,
    ),
  ]);
}

async function prepareMedia(image: ArcaImage, convertWebM: boolean): Promise<{ blob: Blob; filename: string }> {
  const original = await fetchToBlobNative(image.url);
  if (convertWebM && image.isWebM) {
    const webmFile = new File([original], image.filename, { type: original.type || 'video/webm' });
    const converted = await convertWebMToAnimatedWebP(webmFile, null, null, 80);
    return {
      blob: converted,
      filename: image.filename.replace(/\.[^.]+$/, '') + '.webp',
    };
  }
  return normalizeArcaMedia(original, image.filename);
}

async function uploadMedia(
  session: ArcaUploadSession,
  image: ArcaImage,
  convertWebM: boolean,
): Promise<string> {
  const { blob, filename } = await prepareMedia(image, convertWebM);
  if (blob.size > MAX_UPLOAD_SIZE) {
    throw new Error(`${filename} 파일이 아카라이브의 50MB 업로드 제한을 초과합니다.`);
  }

  const boundary = `----RisuToLog${crypto.randomUUID().replace(/-/g, '')}`;
  const body = await createMultipartBody(session.token, filename, blob, boundary);
  const headers: Record<string, string> = {
    Accept: 'application/json',
    'Accept-Language': 'ko-KR,ko;q=0.9,en-US;q=0.8,en;q=0.7',
    'Content-Type': `multipart/form-data; boundary=${boundary}`,
    Origin: ARCA_ORIGIN,
    Referer: ARCA_WRITE_URL,
    'User-Agent': BROWSER_USER_AGENT,
  };
  const response = await Risuai.nativeFetch(ARCA_UPLOAD_URL, {
    method: 'POST',
    headers,
    body: body.buffer,
    logFetch: false,
    requestTimeoutMs: 120_000,
  } as NativeFetchOptions);

  const responseBody = await response.text();
  if (!response.ok) {
    throw new Error(getArcaErrorMessage(responseBody, response.status));
  }

  let link: string | undefined;
  try {
    link = (JSON.parse(responseBody) as { link?: string }).link;
  } catch {
    throw new Error('아카라이브 업로드 응답을 해석하지 못했습니다.');
  }
  if (!link) {
    throw new Error(getArcaErrorMessage(responseBody, response.status));
  }

  const absoluteUrl = new URL(link, ARCA_ORIGIN);
  if (absoluteUrl.protocol !== 'https:') {
    throw new Error('아카라이브가 안전하지 않은 이미지 URL을 반환했습니다.');
  }
  return absoluteUrl.href;
}

async function uploadMediaViaProxy(
  proxy: ArcaProxyConfig,
  image: ArcaImage,
  convertWebM: boolean,
): Promise<string> {
  const { blob, filename } = await prepareMedia(image, convertWebM);
  if (blob.size > MAX_UPLOAD_SIZE) {
    throw new Error(`${filename} 파일이 아카라이브의 50MB 업로드 제한을 초과합니다.`);
  }

  const proxyUrl = validateArcaProxyUrl(proxy.url);
  const payload = JSON.stringify({
    filename,
    mimeType: blob.type || 'application/octet-stream',
    dataBase64: bytesToBase64(new Uint8Array(await blob.arrayBuffer())),
  });

  let response: Response;
  try {
    response = await Risuai.nativeFetch(proxyUrl.href, {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        Authorization: `Bearer ${proxy.token}`,
        'Content-Type': 'application/json',
      },
      body: payload,
      logFetch: false,
      requestTimeoutMs: 120_000,
    } as NativeFetchOptions);
  } catch (error) {
    throw new Error(`사용자 프록시에 연결하지 못했습니다. 프록시의 CORS 설정을 확인하세요. (${String(error)})`);
  }

  const responseBody = await response.text();
  let parsed: { ok?: boolean; url?: string; link?: string; error?: string };
  try {
    parsed = JSON.parse(responseBody);
  } catch {
    throw new Error(`사용자 프록시가 올바르지 않은 응답을 반환했습니다. (HTTP ${response.status})`);
  }
  if (!response.ok || parsed.ok === false) {
    throw new Error(parsed.error || `사용자 프록시 업로드 실패 (HTTP ${response.status})`);
  }

  const link = parsed.url || parsed.link;
  if (!link) {
    throw new Error('사용자 프록시 응답에 업로드 URL이 없습니다.');
  }
  const absoluteUrl = new URL(link, ARCA_ORIGIN);
  if (absoluteUrl.protocol !== 'https:') {
    throw new Error('사용자 프록시가 안전하지 않은 이미지 URL을 반환했습니다.');
  }
  return absoluteUrl.href;
}

export async function uploadMediaToArca(
  images: ArcaImage[],
  options: {
    convertWebM: boolean;
    proxy?: ArcaProxyConfig;
    onProgress?: (progress: ArcaUploadProgress) => void;
  },
): Promise<string[]> {
  if (images.length === 0) return [];

  const session = options.proxy ? null : await createUploadSession();
  const uploadedUrls: string[] = [];

  // Keep uploads sequential so URL order remains deterministic and rate limits stay gentle.
  for (let index = 0; index < images.length; index++) {
    const image = images[index];
    options.onProgress?.({
      current: index,
      total: images.length,
      filename: image.filename,
    });
    uploadedUrls.push(
      options.proxy
        ? await uploadMediaViaProxy(options.proxy, image, options.convertWebM)
        : await uploadMedia(session!, image, options.convertWebM),
    );
  }

  options.onProgress?.({
    current: images.length,
    total: images.length,
    filename: '',
  });
  return uploadedUrls;
}
