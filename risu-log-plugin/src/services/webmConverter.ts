/**
 * WebM to Animated WebP Converter
 *
 * Extracts frames from a WebM video and compiles them into a spec-compliant
 * Animated WebP image binary (RIFF container with VP8X, ANIM, and ANMF chunks).
 */

// ==========================================
// Constants & Configuration
// ==========================================

export const DEFAULT_WEBM_FPS = 10;
export const DEFAULT_WEBM_FALLBACK_FPS = 30;
export const DEFAULT_WEBM_MAX_WIDTH = 500;
export const DEFAULT_WEBM_QUALITY = 80;
export const DEFAULT_ANIM_BG_COLOR = 0x00ffffff; // Background color (ARGB/RGBA default transparent/white)

// WebP FourCC Identifiers
const FOURCC_RIFF = 'RIFF';
const FOURCC_WEBP = 'WEBP';
const FOURCC_VP8X = 'VP8X';
const FOURCC_ANIM = 'ANIM';
const FOURCC_ANMF = 'ANMF';
const FOURCC_VP8 = 'VP8 ';
const FOURCC_VP8L = 'VP8L';
const FOURCC_ALPH = 'ALPH';

// ==========================================
// Types & Interfaces
// ==========================================

export interface WebMConversionOptions {
    /** Target frame rate (FPS). If null or <= 0, defaults to 30. Default: 10. */
    fps?: number | null;
    /** Maximum width in pixels. Height is scaled proportionally. If null, original width is preserved. Default: 500. */
    maxWidth?: number | null;
    /** WebP compression quality (1-100). Default: 80. */
    quality?: number;
    /** Optional callback for conversion progress (0.0 to 1.0). */
    onProgress?: (progress: number, currentFrame: number, totalFrames: number) => void;
}

export interface VideoDimensions {
    width: number;
    height: number;
}

export interface VideoMetadata {
    duration: number;
    originalWidth: number;
    originalHeight: number;
}

// ==========================================
// Binary Utilities (RIFF / WebP)
// ==========================================

/**
 * Writes a 4-character ASCII code (FourCC) into a DataView at the specified offset.
 */
export function writeFourCC(view: DataView, offset: number, fourCC: string): void {
    for (let i = 0; i < 4; i++) {
        view.setUint8(offset + i, fourCC.charCodeAt(i));
    }
}

/**
 * Reads a 4-character ASCII code (FourCC) from a Uint8Array at the specified offset.
 */
export function getFourCC(data: Uint8Array, offset: number): string {
    return String.fromCharCode(
        data[offset],
        data[offset + 1],
        data[offset + 2],
        data[offset + 3]
    );
}

/**
 * Writes a 24-bit unsigned integer in Little-Endian format across 3 bytes.
 */
export function writeUint24LE(view: DataView, offset: number, value: number): void {
    const clamped = Math.max(0, Math.round(value));
    view.setUint8(offset, clamped & 0xff);
    view.setUint8(offset + 1, (clamped >> 8) & 0xff);
    view.setUint8(offset + 2, (clamped >> 16) & 0xff);
}

/**
 * Creates the standard 12-byte RIFF WebP header.
 * [0..3: 'RIFF', 4..7: FileSize - 8, 8..11: 'WEBP']
 */
export function createRIFFHeader(payloadSize: number = 0): ArrayBuffer {
    const buffer = new ArrayBuffer(12);
    const view = new DataView(buffer);
    writeFourCC(view, 0, FOURCC_RIFF);
    view.setUint32(4, payloadSize, true); // Placeholder or actual size
    writeFourCC(view, 8, FOURCC_WEBP);
    return buffer;
}

/**
 * Creates an 18-byte VP8X extended WebP header chunk.
 * Specifies canvas dimensions and feature flags (animation, alpha, etc.).
 */
export function createVP8XChunk(
    width: number,
    height: number,
    hasAnimation: boolean = true
): ArrayBuffer {
    const buffer = new ArrayBuffer(18);
    const view = new DataView(buffer);

    writeFourCC(view, 0, FOURCC_VP8X);
    view.setUint32(4, 10, true); // Payload size is always 10 bytes
    view.setUint8(8, hasAnimation ? 0x02 : 0x00); // Flags (bit 1: Animation)
    view.setUint8(9, 0); // Reserved
    view.setUint8(10, 0); // Reserved
    view.setUint8(11, 0); // Reserved

    // Canvas width - 1 and height - 1 (24-bit LE)
    writeUint24LE(view, 12, width - 1);
    writeUint24LE(view, 15, height - 1);

    return buffer;
}

/**
 * Creates a 14-byte ANIM chunk specifying global animation parameters.
 * [0..3: 'ANIM', 4..7: 6 (size), 8..11: BG color (Big Endian), 12..13: loop count (Little Endian, 0=infinite)]
 */
export function createANIMChunk(
    bgColor: number = DEFAULT_ANIM_BG_COLOR,
    loopCount: number = 0
): ArrayBuffer {
    const buffer = new ArrayBuffer(14);
    const view = new DataView(buffer);

    writeFourCC(view, 0, FOURCC_ANIM);
    view.setUint32(4, 6, true); // Chunk payload size
    view.setUint32(8, bgColor, false); // BG Color (Big Endian)
    view.setUint16(12, loopCount, true); // Loop count (0 = infinite)

    return buffer;
}

/**
 * Creates an ANMF animation frame chunk wrapping frame bitstream data.
 */
export function createANMFChunk(
    frameData: Uint8Array,
    durationMs: number,
    width: number,
    height: number
): ArrayBuffer {
    const frameDataSize = frameData.byteLength;
    const payloadSize = 16 + frameDataSize;
    const paddedPayloadSize = payloadSize + (payloadSize % 2);
    const buffer = new ArrayBuffer(8 + paddedPayloadSize);
    const view = new DataView(buffer);

    // Chunk Header: 'ANMF' (4 bytes) + payloadSize (4 bytes LE)
    writeFourCC(view, 0, FOURCC_ANMF);
    view.setUint32(4, payloadSize, true);

    // Frame X offset (3 bytes LE) and Y offset (3 bytes LE) -> 0
    writeUint24LE(view, 8, 0);
    writeUint24LE(view, 11, 0);

    // Frame Width - 1 (3 bytes LE) and Height - 1 (3 bytes LE)
    writeUint24LE(view, 14, width - 1);
    writeUint24LE(view, 17, height - 1);

    // Frame Duration in milliseconds (3 bytes LE)
    writeUint24LE(view, 20, durationMs);

    // Frame Flags: 1 byte (bit 0: Blending [0=alpha blend], bit 1: Disposal [0=do not dispose])
    view.setUint8(23, 0);

    // Frame Payload data (VP8 / VP8L / ALPH chunks)
    new Uint8Array(buffer, 24, frameDataSize).set(frameData);

    // If payload size is odd, 1 byte of padding (0x00) is appended
    if (payloadSize % 2 === 1) {
        view.setUint8(8 + payloadSize, 0);
    }

    return buffer;
}

/**
 * Parses a single-frame WebP file and extracts its VP8/VP8L/ALPH bitstream payload.
 */
export function extractWebPFramePayload(webpBytes: Uint8Array): Uint8Array {
    if (webpBytes.byteLength < 12) {
        throw new Error('유효하지 않은 WebP 데이터: 버퍼 길이가 너무 짧습니다.');
    }

    const view = new DataView(webpBytes.buffer, webpBytes.byteOffset, webpBytes.byteLength);
    const riff = getFourCC(webpBytes, 0);
    const webp = getFourCC(webpBytes, 8);

    if (riff !== FOURCC_RIFF || webp !== FOURCC_WEBP) {
        throw new Error(`유효하지 않은 WebP 헤더 (RIFF/WEBP 예상, 수신: ${riff}/${webp})`);
    }

    let offset = 12;
    let frameDataStart = -1;

    while (offset + 8 <= webpBytes.byteLength) {
        const chunkType = getFourCC(webpBytes, offset);
        const chunkSize = view.getUint32(offset + 4, true);

        if (chunkType === FOURCC_ALPH && frameDataStart === -1) {
            frameDataStart = offset;
        } else if (chunkType === FOURCC_VP8 || chunkType === FOURCC_VP8L) {
            if (frameDataStart === -1) {
                frameDataStart = offset;
            }
            const chunkTotalLength = 8 + chunkSize + (chunkSize % 2);
            const frameDataEnd = Math.min(offset + chunkTotalLength, webpBytes.byteLength);
            return webpBytes.slice(frameDataStart, frameDataEnd);
        }

        offset += 8 + chunkSize + (chunkSize % 2);
    }

    if (frameDataStart !== -1) {
        return webpBytes.slice(frameDataStart);
    }

    throw new Error('WebP 프레임에서 VP8/VP8L 청크를 찾을 수 없습니다.');
}

/**
 * Combines RIFF header, VP8X, ANIM, and ANMF chunks into a complete WebP binary.
 */
export function assembleChunks(chunks: ArrayBuffer[]): ArrayBuffer {
    const totalSize = chunks.reduce((sum, chunk) => sum + chunk.byteLength, 0);
    const result = new Uint8Array(totalSize);
    let offset = 0;

    for (const chunk of chunks) {
        result.set(new Uint8Array(chunk), offset);
        offset += chunk.byteLength;
    }

    // Write the actual file size (totalSize - 8) into the RIFF header
    const view = new DataView(result.buffer, result.byteOffset, result.byteLength);
    view.setUint32(4, totalSize - 8, true);

    return result.buffer;
}

// ==========================================
// Video & Canvas Helpers
// ==========================================

/**
 * Calculates scaled video dimensions while preserving original aspect ratio.
 */
export function calculateScaledDimensions(
    originalWidth: number,
    originalHeight: number,
    maxWidth: number | null = DEFAULT_WEBM_MAX_WIDTH
): VideoDimensions {
    if (!maxWidth || maxWidth <= 0 || originalWidth <= maxWidth) {
        return {
            width: Math.max(1, Math.round(originalWidth)),
            height: Math.max(1, Math.round(originalHeight)),
        };
    }

    const scale = maxWidth / originalWidth;
    return {
        width: Math.max(1, Math.round(maxWidth)),
        height: Math.max(1, Math.round(originalHeight * scale)),
    };
}

/**
 * Loads video element metadata with timeout protection and duration resolution.
 */
function loadVideoElement(
    source: Blob | File | string,
    timeoutMs: number = 15000
): Promise<{ video: HTMLVideoElement; objectUrl: string | null }> {
    return new Promise((resolve, reject) => {
        const video = document.createElement('video');
        video.muted = true;
        video.playsInline = true;
        video.preload = 'auto';

        let objectUrl: string | null = null;
        let timer: ReturnType<typeof setTimeout> | null = null;

        const cleanup = () => {
            if (timer !== null) {
                clearTimeout(timer);
                timer = null;
            }
            video.onloadedmetadata = null;
            video.onerror = null;
        };

        if (typeof source === 'string') {
            video.src = source;
        } else {
            objectUrl = URL.createObjectURL(source);
            video.src = objectUrl;
        }

        timer = setTimeout(() => {
            cleanup();
            if (objectUrl) URL.revokeObjectURL(objectUrl);
            reject(new Error(`비디오 메타데이터 로드 타임아웃 (${timeoutMs}ms 초과)`));
        }, timeoutMs);

        video.onloadedmetadata = () => {
            cleanup();

            // Handle WebM with missing/infinite duration (e.g. MediaRecorder streaming webm)
            if (video.duration === Infinity || isNaN(video.duration)) {
                const onTimeUpdate = () => {
                    video.removeEventListener('timeupdate', onTimeUpdate);
                    video.currentTime = 0;
                    resolve({ video, objectUrl });
                };
                video.addEventListener('timeupdate', onTimeUpdate, { once: true });
                video.currentTime = 1e101;
            } else {
                resolve({ video, objectUrl });
            }
        };

        video.onerror = () => {
            cleanup();
            if (objectUrl) URL.revokeObjectURL(objectUrl);
            const mediaError = video.error
                ? ` (코드: ${video.error.code}, 메시지: ${video.error.message || '상세 없음'})`
                : '';
            reject(new Error(`비디오를 로드할 수 없습니다.${mediaError}`));
        };
    });
}

/**
 * Seeks a video element to the specified time in seconds and waits for the frame to be ready.
 */
function seekVideo(
    video: HTMLVideoElement,
    timeSeconds: number,
    timeoutMs: number = 5000
): Promise<void> {
    return new Promise((resolve) => {
        if (Math.abs(video.currentTime - timeSeconds) < 0.001) {
            resolve();
            return;
        }

        let timer: ReturnType<typeof setTimeout> | null = null;

        const onSeeked = () => {
            if (timer !== null) clearTimeout(timer);
            video.removeEventListener('seeked', onSeeked);
            video.removeEventListener('error', onError);
            resolve();
        };

        const onError = () => {
            if (timer !== null) clearTimeout(timer);
            video.removeEventListener('seeked', onSeeked);
            video.removeEventListener('error', onError);
            resolve(); // Resolve on seek error to prevent total conversion failure
        };

        timer = setTimeout(() => {
            video.removeEventListener('seeked', onSeeked);
            video.removeEventListener('error', onError);
            resolve();
        }, timeoutMs);

        video.addEventListener('seeked', onSeeked, { once: true });
        video.addEventListener('error', onError, { once: true });
        video.currentTime = timeSeconds;
    });
}

/**
 * Converts a Canvas element to a WebP Blob with the specified quality.
 */
function canvasToWebPBlob(canvas: HTMLCanvasElement, quality: number): Promise<Blob> {
    return new Promise((resolve, reject) => {
        const qualityFraction = Math.min(Math.max(quality / 100, 0.01), 1.0);
        canvas.toBlob(
            (blob) => {
                if (blob) {
                    resolve(blob);
                } else {
                    reject(new Error('Canvas에서 WebP Blob을 생성하지 못했습니다.'));
                }
            },
            'image/webp',
            qualityFraction
        );
    });
}

/**
 * Encodes the current content of a canvas to a WebP frame payload (VP8/VP8L).
 */
async function encodeCanvasFrame(canvas: HTMLCanvasElement, quality: number): Promise<Uint8Array> {
    const blob = await canvasToWebPBlob(canvas, quality);
    const arrayBuffer = await blob.arrayBuffer();
    return extractWebPFramePayload(new Uint8Array(arrayBuffer));
}

// ==========================================
// Public Animated WebP Encoders
// ==========================================

/**
 * Encodes an array of ImageData frames into an Animated WebP ArrayBuffer.
 * Reuses a single canvas for high performance and low memory consumption.
 */
export async function encodeAnimatedWebP(
    frames: ImageData[],
    width: number,
    height: number,
    delayMs: number,
    quality: number = DEFAULT_WEBM_QUALITY
): Promise<ArrayBuffer> {
    const targetWidth = Math.max(1, Math.round(width));
    const targetHeight = Math.max(1, Math.round(height));

    const chunks: ArrayBuffer[] = [
        createRIFFHeader(),
        createVP8XChunk(targetWidth, targetHeight, true),
        createANIMChunk(DEFAULT_ANIM_BG_COLOR, 0),
    ];

    const canvas = document.createElement('canvas');
    canvas.width = targetWidth;
    canvas.height = targetHeight;
    const ctx = canvas.getContext('2d');

    if (!ctx) {
        throw new Error('Canvas 2D context를 가져올 수 없습니다.');
    }

    try {
        for (let i = 0; i < frames.length; i++) {
            ctx.putImageData(frames[i], 0, 0);
            const framePayload = await encodeCanvasFrame(canvas, quality);
            const anmf = createANMFChunk(framePayload, delayMs, targetWidth, targetHeight);
            chunks.push(anmf);
        }
    } finally {
        canvas.width = 0;
        canvas.height = 0;
    }

    return assembleChunks(chunks);
}

/**
 * Converts a WebM video file to an Animated WebP Blob.
 *
 * @param file - WebM video file or Blob
 * @param fps - Target frame rate (null or <= 0 defaults to 30, undefined defaults to 10)
 * @param maxWidth - Maximum width (null preserves original width, default: 500)
 * @param quality - Compression quality (1-100, default: 80)
 * @param options - Additional options including progress callbacks
 * @returns Promise resolving to the animated WebP Blob
 */
export async function convertWebMToAnimatedWebP(
    file: File | Blob,
    fps: number | null = DEFAULT_WEBM_FPS,
    maxWidth: number | null = DEFAULT_WEBM_MAX_WIDTH,
    quality: number = DEFAULT_WEBM_QUALITY,
    options?: WebMConversionOptions
): Promise<Blob> {
    const effectiveFps = options?.fps ?? (fps !== null && fps !== undefined && fps > 0 ? fps : DEFAULT_WEBM_FALLBACK_FPS);
    const effectiveMaxWidth = options?.maxWidth !== undefined ? options.maxWidth : maxWidth;
    const effectiveQuality = Math.min(Math.max(options?.quality ?? quality, 1), 100);
    const onProgress = options?.onProgress;

    const { video, objectUrl } = await loadVideoElement(file);

    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');

    try {
        if (!ctx) {
            throw new Error('Canvas 2D context를 가져올 수 없습니다.');
        }

        const originalWidth = video.videoWidth || 1;
        const originalHeight = video.videoHeight || 1;
        const duration = Math.max(video.duration || 0, 0.01);

        const { width: targetWidth, height: targetHeight } = calculateScaledDimensions(
            originalWidth,
            originalHeight,
            effectiveMaxWidth
        );

        canvas.width = targetWidth;
        canvas.height = targetHeight;

        const frameInterval = 1 / effectiveFps;
        const delayMs = Math.max(1, Math.round(frameInterval * 1000));
        const totalFrames = Math.max(1, Math.floor(duration * effectiveFps));

        console.log('[WebM Converter] 변환 시작:', {
            원본: `${originalWidth}x${originalHeight}`,
            변환후: `${targetWidth}x${targetHeight}`,
            fps: effectiveFps,
            quality: effectiveQuality,
            duration: `${duration.toFixed(2)}초`,
        });
        console.log(`[WebM Converter] 프레임 추출 및 인코딩 중... (총 ${totalFrames}개 예상)`);

        const chunks: ArrayBuffer[] = [
            createRIFFHeader(),
            createVP8XChunk(targetWidth, targetHeight, true),
            createANIMChunk(DEFAULT_ANIM_BG_COLOR, 0),
        ];

        let frameCount = 0;

        for (let time = 0; time < duration; time += frameInterval) {
            if (time > 0) {
                await seekVideo(video, time);
            }

            ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
            const framePayload = await encodeCanvasFrame(canvas, effectiveQuality);
            const anmf = createANMFChunk(framePayload, delayMs, targetWidth, targetHeight);
            chunks.push(anmf);

            frameCount++;

            const progress = Math.min(frameCount / totalFrames, 1.0);
            onProgress?.(progress, frameCount, totalFrames);

            if (frameCount % Math.max(1, Math.floor(totalFrames / 10)) === 0 || frameCount === totalFrames) {
                console.log(
                    `[WebM Converter] 진행: ${frameCount}/${totalFrames} (${Math.round(progress * 100)}%)`
                );
            }
        }

        // Safety fallback: if no frames were captured, draw current frame
        if (frameCount === 0) {
            ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
            const framePayload = await encodeCanvasFrame(canvas, effectiveQuality);
            const anmf = createANMFChunk(framePayload, delayMs, targetWidth, targetHeight);
            chunks.push(anmf);
        }

        console.log(`[WebM Converter] 프레임 처리 완료: ${frameCount || 1}개`);

        const webpData = assembleChunks(chunks);
        console.log('[WebM Converter] 인코딩 완료');

        return new Blob([webpData], { type: 'image/webp' });
    } finally {
        // Guarantee cleanup of video element, object URLs, and canvas memory
        if (objectUrl) {
            URL.revokeObjectURL(objectUrl);
        }
        video.src = '';
        video.load();
        canvas.width = 0;
        canvas.height = 0;
    }
}
