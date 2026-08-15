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

// ============================================================================
// Constants & Configurations
// ============================================================================

const ARCA_ORIGIN = 'https://arca.live';
const ARCA_WRITE_URL = `${ARCA_ORIGIN}/b/logtest/write`;
const ARCA_UPLOAD_URL = `${ARCA_ORIGIN}/b/upload`;

/** Maximum upload file size allowed by Arca.live (50MB) */
export const MAX_UPLOAD_SIZE = 50 * 1024 * 1024;

/** Session token retrieval request timeout in milliseconds */
const DEFAULT_SESSION_TIMEOUT_MS = 30_000;

/** Upload request timeout in milliseconds */
const DEFAULT_UPLOAD_TIMEOUT_MS = 120_000;

/** Default retry attempts for transient network/server failures */
const DEFAULT_MAX_RETRIES = 2;

/** Base delay in milliseconds between retry attempts */
const DEFAULT_RETRY_DELAY_MS = 1_000;

/** Supported MIME types directly accepted by Arca.live upload endpoint */
const SUPPORTED_ARCA_MIME_TYPES = new Set<string>([
  'image/gif',
  'image/jpeg',
  'image/png',
  'image/webp',
  'video/mp4',
  'video/quicktime',
  'video/webm',
]);

const BROWSER_USER_AGENT =
  (typeof navigator !== 'undefined' && navigator.userAgent) ||
  'Mozilla/5.0 AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36';

// ============================================================================
// Interfaces & Types
// ============================================================================

/** Internal session containing the CSRF upload token parsed from Arca.live */
export interface ArcaUploadSession {
  token: string;
}

/** Extended options for Risuai nativeFetch implementation */
interface NativeFetchOptions extends RequestInit {
  logFetch?: boolean;
  requestTimeoutMs?: number;
}

/** Progress notification emitted during batch upload */
export interface ArcaUploadProgress {
  /** 0-based index of the currently uploading item, or total when completed */
  current: number;
  /** Total count of items to upload */
  total: number;
  /** Filename of the item currently being uploaded */
  filename: string;
}

/** Configuration options for the upload process */
export interface ArcaUploadOptions {
  /** Whether to convert animated WebM videos to Animated WebP */
  convertWebM: boolean;
  /** Optional custom proxy configuration to route uploads */
  proxy?: ArcaProxyConfig;
  /** Callback to receive progress notifications */
  onProgress?: (progress: ArcaUploadProgress) => void;
  /** Optional AbortSignal to cancel in-flight uploads */
  signal?: AbortSignal;
  /** Maximum retry attempts on transient network or 5xx failures (default: 2) */
  maxRetries?: number;
  /** Base retry delay in milliseconds (default: 1000ms) */
  retryDelayMs?: number;
}

/** Normalization result containing the processed Blob and filename */
export interface PreparedMedia {
  blob: Blob;
  filename: string;
}

// ============================================================================
// Error Handling Utilities
// ============================================================================

/**
 * Extracts a human-readable error message from an Arca.live HTTP response.
 */
export function getArcaErrorMessage(body: string, status: number): string {
  if (body) {
    try {
      const parsed = JSON.parse(body) as { message?: string; error?: string };
      if (typeof parsed.message === 'string' && parsed.message.trim()) {
        return parsed.message;
      }
      if (typeof parsed.error === 'string' && parsed.error.trim()) {
        return parsed.error;
      }
    } catch {
      // The endpoint sometimes returns an HTML error page from Cloudflare or Nginx.
    }
  }

  if (status === 403) {
    return '아카라이브 접근이 차단되었습니다 (Cloudflare 또는 봇 방지). 사용자 프록시를 사용해 보세요.';
  }
  if (status === 413) {
    return '파일 크기가 아카라이브 업로드 제한(50MB)을 초과했습니다.';
  }
  if (status >= 500) {
    return `아카라이브 서버에 일시적인 오류가 발생했습니다. (HTTP ${status})`;
  }
  return `아카라이브가 업로드 요청을 거절했습니다. (HTTP ${status})`;
}

/**
 * Determines if an error is transient and can be retried.
 */
function isRetryableError(error: unknown): boolean {
  if (error instanceof DOMException && error.name === 'AbortError') {
    return false;
  }
  if (error instanceof Error) {
    // Non-retryable user errors
    if (
      error.message.includes('50MB 업로드 제한') ||
      error.message.includes('MIME 타입') ||
      error.message.includes('안전하지 않은 이미지 URL') ||
      error.message.includes('토큰을 찾지 못했습니다') ||
      error.message.includes('HTTP 400') ||
      error.message.includes('HTTP 401') ||
      error.message.includes('HTTP 403') ||
      error.message.includes('HTTP 404') ||
      error.message.includes('HTTP 413')
    ) {
      return false;
    }
  }
  return true;
}

/**
 * Asynchronously pauses execution with abort signal listener support.
 */
function sleep(ms: number, signal?: AbortSignal): Promise<void> {
  if (ms <= 0) return Promise.resolve();
  return new Promise((resolve, reject) => {
    if (signal?.aborted) {
      reject(new DOMException('Upload aborted by user', 'AbortError'));
      return;
    }
    const timer = setTimeout(() => {
      signal?.removeEventListener('abort', onAbort);
      resolve();
    }, ms);
    const onAbort = () => {
      clearTimeout(timer);
      reject(new DOMException('Upload aborted by user', 'AbortError'));
    };
    signal?.addEventListener('abort', onAbort, { once: true });
  });
}

/**
 * Executes an asynchronous task with exponential backoff retries.
 */
async function withRetry<T>(
  task: () => Promise<T>,
  options: {
    maxRetries?: number;
    retryDelayMs?: number;
    signal?: AbortSignal;
    taskName?: string;
  } = {},
): Promise<T> {
  const maxRetries = options.maxRetries ?? DEFAULT_MAX_RETRIES;
  const baseDelay = options.retryDelayMs ?? DEFAULT_RETRY_DELAY_MS;
  let lastError: unknown;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    if (options.signal?.aborted) {
      throw new DOMException('Upload aborted by user', 'AbortError');
    }

    try {
      return await task();
    } catch (error) {
      lastError = error;

      if (options.signal?.aborted) {
        throw new DOMException('Upload aborted by user', 'AbortError');
      }

      const isLastAttempt = attempt >= maxRetries;
      if (isLastAttempt || !isRetryableError(error)) {
        throw error;
      }

      const delayMs = baseDelay * Math.pow(2, attempt);
      console.warn(
        `[Arca Upload] ${options.taskName || '작업'} 실패 (${attempt + 1}/${maxRetries} 재시도 대기 ${delayMs}ms):`,
        error,
      );
      await sleep(delayMs, options.signal);
    }
  }

  throw lastError;
}

// ============================================================================
// Binary & MIME Utilities
// ============================================================================

/** Encodes a UTF-8 string into a Uint8Array */
function encodeUtf8(value: string): Uint8Array {
  return new TextEncoder().encode(value);
}

/**
 * Converts a Uint8Array to a Base64 string in chunks to prevent stack overflow.
 */
function bytesToBase64(bytes: Uint8Array): string {
  const CHUNK_SIZE = 0x8000; // 32KB chunking
  let binary = '';
  for (let offset = 0; offset < bytes.length; offset += CHUNK_SIZE) {
    binary += String.fromCharCode(...bytes.subarray(offset, offset + CHUNK_SIZE));
  }
  return btoa(binary);
}

/** Concatenates multiple Uint8Arrays into a single unified buffer */
function concatBytes(parts: Uint8Array[]): Uint8Array {
  const totalLength = parts.reduce((total, part) => total + part.byteLength, 0);
  const result = new Uint8Array(totalLength);
  let offset = 0;
  for (const part of parts) {
    result.set(part, offset);
    offset += part.byteLength;
  }
  return result;
}

/**
 * Detects the MIME type of a media buffer using binary magic numbers and signatures.
 */
export function detectMediaMimeType(bytes: Uint8Array): string | null {
  if (bytes.length < 4) return null;

  // PNG: 89 50 4E 47 0D 0A 1A 0A
  if (
    bytes.length >= 8 &&
    bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47 &&
    bytes[4] === 0x0d && bytes[5] === 0x0a && bytes[6] === 0x1a && bytes[7] === 0x0a
  ) {
    return 'image/png';
  }

  // JPEG: FF D8 FF
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) {
    return 'image/jpeg';
  }

  // WebM / Matroska EBML: 1A 45 DF A3
  if (
    bytes.length >= 4 &&
    bytes[0] === 0x1a && bytes[1] === 0x45 && bytes[2] === 0xdf && bytes[3] === 0xa3
  ) {
    return 'video/webm';
  }

  // ASCII-based header inspections
  const asciiHeader = new TextDecoder('ascii', { fatal: false }).decode(bytes.subarray(0, 64));

  // GIF: GIF87a or GIF89a
  if (asciiHeader.startsWith('GIF87a') || asciiHeader.startsWith('GIF89a')) {
    return 'image/gif';
  }

  // WebP: RIFF .... WEBP
  if (asciiHeader.startsWith('RIFF') && asciiHeader.slice(8, 12) === 'WEBP') {
    return 'image/webp';
  }

  // MP4 / QuickTime / AVIF: [size] ftyp [brand]
  if (asciiHeader.slice(4, 8) === 'ftyp') {
    const brand = asciiHeader.slice(8, 12);
    if (brand === 'qt  ') return 'video/quicktime';
    if (brand === 'avif' || brand === 'avis') return 'image/avif';
    return 'video/mp4';
  }

  // BMP: BM
  if (asciiHeader.startsWith('BM')) {
    return 'image/bmp';
  }

  // SVG / XML
  const textPrefix = new TextDecoder('utf-8', { fatal: false })
    .decode(bytes.subarray(0, 128))
    .trimStart()
    .toLowerCase();
  if (textPrefix.startsWith('<svg') || textPrefix.startsWith('<?xml')) {
    return 'image/svg+xml';
  }

  return null;
}

/**
 * Returns the recommended file extension for a given MIME type.
 */
export function extensionForMimeType(mimeType: string): string {
  switch (mimeType.toLowerCase()) {
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

// ============================================================================
// Media Preparation & Normalization
// ============================================================================

/**
 * Normalizes a media blob for Arca upload compatibility.
 * Directly supported formats are tagged with correct MIME and extension.
 * Non-supported image formats (e.g. BMP, SVG, AVIF) are converted to WebP via Canvas.
 */
export async function normalizeArcaMedia(blob: Blob, filename: string): Promise<PreparedMedia> {
  const prefix = new Uint8Array(await blob.slice(0, 512).arrayBuffer());
  const detectedMimeType = detectMediaMimeType(prefix);
  const declaredMimeType = blob.type.toLowerCase().split(';', 1)[0].trim();
  const mimeType = detectedMimeType || declaredMimeType;

  // If directly supported by Arca, normalize blob type and extension
  if (mimeType && SUPPORTED_ARCA_MIME_TYPES.has(mimeType)) {
    const normalizedBlob = blob.type === mimeType ? blob : new Blob([blob], { type: mimeType });
    const extension = extensionForMimeType(mimeType);
    const baseName = filename.replace(/\.[^.]+$/, '');
    return {
      blob: normalizedBlob,
      filename: `${baseName}.${extension}`,
    };
  }

  // If it's an image format requiring conversion (e.g., BMP, SVG, TIFF, AVIF) -> convert to WebP
  const isConvertibleImage =
    (mimeType && mimeType.startsWith('image/')) || declaredMimeType.startsWith('image/');
  if (isConvertibleImage) {
    try {
      const canvas = await loadImageBlobToCanvas(blob);
      const webpBlob = await canvasToBlob(canvas, 'image/webp', 0.9);
      const baseName = filename.replace(/\.[^.]+$/, '');
      return {
        blob: webpBlob,
        filename: `${baseName}.webp`,
      };
    } catch (error) {
      throw new Error(
        `${filename} 이미지를 아카라이브용 WebP로 변환하지 못했습니다. (${mimeType || '알 수 없는 형식'}: ${String(error)})`,
      );
    }
  }

  throw new Error(`${filename}의 미디어 형식을 판별하지 못했습니다. (${mimeType || 'MIME 타입 없음'})`);
}

/**
 * Fetches and prepares media for upload, performing WebM-to-WebP conversion if enabled.
 */
export async function prepareMedia(image: ArcaImage, convertWebM: boolean): Promise<PreparedMedia> {
  const originalBlob = await fetchToBlobNative(image.url);

  if (convertWebM && image.isWebM) {
    const webmFile = new File([originalBlob], image.filename, {
      type: originalBlob.type || 'video/webm',
    });
    const convertedBlob = await convertWebMToAnimatedWebP(webmFile, null, null, 80);
    const baseName = image.filename.replace(/\.[^.]+$/, '');
    return {
      blob: convertedBlob,
      filename: `${baseName}.webp`,
    };
  }

  return normalizeArcaMedia(originalBlob, image.filename);
}

// ============================================================================
// Multipart Payload Builder
// ============================================================================

/**
 * Builds the binary multipart/form-data payload required by Arca.live upload API.
 */
export async function createMultipartBody(
  token: string,
  filename: string,
  blob: Blob,
  boundary: string,
): Promise<Uint8Array> {
  const safeFilename = filename.replace(/["\r\n]/g, '_');
  const mimeType = blob.type || 'application/octet-stream';
  const blobBytes = new Uint8Array(await blob.arrayBuffer());

  const headerPart = encodeUtf8(
    `--${boundary}\r\n` +
      `Content-Disposition: form-data; name="upload"; filename="${safeFilename}"\r\n` +
      `Content-Type: ${mimeType}\r\n\r\n`,
  );

  const footerPart = encodeUtf8(
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
  );

  return concatBytes([headerPart, blobBytes, footerPart]);
}

// ============================================================================
// Arca Session & Upload Implementations
// ============================================================================

/**
 * Fetches the Arca.live write page and extracts the session upload token.
 */
export async function createUploadSession(signal?: AbortSignal): Promise<ArcaUploadSession> {
  if (signal?.aborted) {
    throw new DOMException('Upload aborted by user', 'AbortError');
  }

  const response = await Risuai.nativeFetch(ARCA_WRITE_URL, {
    method: 'GET',
    headers: {
      Accept:
        'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
      'Accept-Language': 'ko-KR,ko;q=0.9,en-US;q=0.8,en;q=0.7',
      'User-Agent': BROWSER_USER_AGENT,
    },
    logFetch: false,
    requestTimeoutMs: DEFAULT_SESSION_TIMEOUT_MS,
  } as NativeFetchOptions);

  const html = await response.text();
  if (!response.ok) {
    throw new Error(getArcaErrorMessage(html, response.status));
  }

  const document = new DOMParser().parseFromString(html, 'text/html');
  const token = (document.querySelector('input[name="token"]') as HTMLInputElement | null)?.value;
  if (!token) {
    throw new Error(
      '아카라이브 글쓰기 페이지에서 업로드 토큰을 찾지 못했습니다. Cloudflare 차단 또는 페이지 변경 가능성이 있습니다.',
    );
  }

  return { token };
}

/**
 * Uploads a prepared media file directly to Arca.live.
 */
export async function uploadMediaDirect(
  session: ArcaUploadSession,
  media: PreparedMedia,
  signal?: AbortSignal,
): Promise<string> {
  if (signal?.aborted) {
    throw new DOMException('Upload aborted by user', 'AbortError');
  }

  const { blob, filename } = media;
  if (blob.size > MAX_UPLOAD_SIZE) {
    const sizeMb = (blob.size / (1024 * 1024)).toFixed(1);
    throw new Error(`${filename} 파일이 아카라이브의 50MB 업로드 제한을 초과합니다. (${sizeMb}MB)`);
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
    requestTimeoutMs: DEFAULT_UPLOAD_TIMEOUT_MS,
  } as NativeFetchOptions);

  const responseBody = await response.text();
  if (!response.ok) {
    throw new Error(getArcaErrorMessage(responseBody, response.status));
  }

  let parsed: { link?: string; url?: string };
  try {
    parsed = JSON.parse(responseBody);
  } catch {
    throw new Error('아카라이브 업로드 응답을 해석하지 못했습니다.');
  }

  const link = parsed.link || parsed.url;
  if (!link) {
    throw new Error(getArcaErrorMessage(responseBody, response.status));
  }

  const absoluteUrl = new URL(link, ARCA_ORIGIN);
  if (absoluteUrl.protocol !== 'https:') {
    throw new Error('아카라이브가 안전하지 않은 이미지 URL을 반환했습니다.');
  }

  return absoluteUrl.href;
}

/**
 * Uploads a prepared media file via a user-configured proxy server.
 */
export async function uploadMediaViaProxy(
  proxy: ArcaProxyConfig,
  media: PreparedMedia,
  signal?: AbortSignal,
): Promise<string> {
  if (signal?.aborted) {
    throw new DOMException('Upload aborted by user', 'AbortError');
  }

  const { blob, filename } = media;
  if (blob.size > MAX_UPLOAD_SIZE) {
    const sizeMb = (blob.size / (1024 * 1024)).toFixed(1);
    throw new Error(`${filename} 파일이 아카라이브의 50MB 업로드 제한을 초과합니다. (${sizeMb}MB)`);
  }

  const proxyUrl = validateArcaProxyUrl(proxy.url);
  const dataBase64 = bytesToBase64(new Uint8Array(await blob.arrayBuffer()));
  const payload = JSON.stringify({
    filename,
    mimeType: blob.type || 'application/octet-stream',
    dataBase64,
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
      requestTimeoutMs: DEFAULT_UPLOAD_TIMEOUT_MS,
    } as NativeFetchOptions);
  } catch (error) {
    if (signal?.aborted) {
      throw new DOMException('Upload aborted by user', 'AbortError');
    }
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

// ============================================================================
// Batch Upload Orchestrator
// ============================================================================

/**
 * Uploads a collection of media images/videos to Arca.live sequentially.
 * Supports direct upload with CSRF session token or custom proxy routing,
 * progress reporting, automatic retries for transient failures, and cancellation.
 *
 * @param images - Array of ArcaImage items to upload
 * @param options - Upload configuration options
 * @returns Array of uploaded HTTPS media URLs in identical sequence as input
 */
export async function uploadMediaToArca(
  images: ArcaImage[],
  options: ArcaUploadOptions,
): Promise<string[]> {
  if (images.length === 0) return [];

  const {
    convertWebM,
    proxy,
    onProgress,
    signal,
    maxRetries = DEFAULT_MAX_RETRIES,
    retryDelayMs = DEFAULT_RETRY_DELAY_MS,
  } = options;

  if (signal?.aborted) {
    throw new DOMException('Upload aborted by user', 'AbortError');
  }

  // Create upload session if uploading directly to Arca (no proxy)
  const session: ArcaUploadSession | null = proxy
    ? null
    : await withRetry(() => createUploadSession(signal), {
        maxRetries,
        retryDelayMs,
        signal,
        taskName: '세션 생성',
      });

  const uploadedUrls: string[] = [];

  // Keep uploads sequential so URL order remains deterministic and rate limits stay gentle.
  for (let index = 0; index < images.length; index++) {
    if (signal?.aborted) {
      throw new DOMException('Upload aborted by user', 'AbortError');
    }

    const image = images[index];

    onProgress?.({
      current: index,
      total: images.length,
      filename: image.filename,
    });

    // 1. Prepare & normalize media format
    const prepared = await prepareMedia(image, convertWebM);

    // 2. Upload with retry support
    const uploadedUrl = await withRetry(
      () =>
        proxy
          ? uploadMediaViaProxy(proxy, prepared, signal)
          : uploadMediaDirect(session!, prepared, signal),
      {
        maxRetries,
        retryDelayMs,
        signal,
        taskName: `미디어 업로드 (${image.filename})`,
      },
    );

    uploadedUrls.push(uploadedUrl);
  }

  // Final progress update
  onProgress?.({
    current: images.length,
    total: images.length,
    filename: '',
  });

  return uploadedUrls;
}
