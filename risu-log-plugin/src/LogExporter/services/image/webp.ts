/**
 * webp.ts — WebP binary merging, chunk parsing, container metadata & encoding services.
 *
 * Provides utilities for:
 * 1. WebP RIFF container and chunk parsing (VP8, VP8L, VP8X, ALPH, ANIM, ANMF, EXIF, XMP, ICCP).
 * 2. WebP container metadata chunk generation and chunk assembly.
 * 3. Lossless multi-image vertical merging via binary PNG pipeline and WebP re-encoding.
 */

import { mergePNGsBinary } from './png';
import imageCompression from 'browser-image-compression';
import { loadImageBlobToCanvas, canvasToBlob } from '../../utils/imageUtils';

// ============================================================================
// 1. Constants & FourCC Identifiers
// ============================================================================

/** WebP RIFF FourCC identifiers */
export const FOURCC_RIFF = 'RIFF' as const;
export const FOURCC_WEBP = 'WEBP' as const;
export const FOURCC_VP8X = 'VP8X' as const; // Extended format chunk
export const FOURCC_VP8 = 'VP8 ' as const;  // Lossy bitstream chunk
export const FOURCC_VP8L = 'VP8L' as const; // Lossless bitstream chunk
export const FOURCC_ALPH = 'ALPH' as const; // Alpha bitstream chunk
export const FOURCC_ANIM = 'ANIM' as const; // Animation control chunk
export const FOURCC_ANMF = 'ANMF' as const; // Animation frame chunk
export const FOURCC_EXIF = 'EXIF' as const; // EXIF metadata chunk
export const FOURCC_XMP = 'XMP ' as const;  // XMP metadata chunk
export const FOURCC_ICCP = 'ICCP' as const; // ICC color profile chunk

/** VP8X extended header feature flag bitmasks */
export const VP8X_FLAGS = {
    /** bit 5: Color profile present (ICCP chunk) */
    ICC: 0x20,
    /** bit 4: Alpha bitstream present (ALPH chunk or VP8L alpha) */
    ALPHA: 0x10,
    /** bit 3: EXIF metadata present (EXIF chunk) */
    EXIF: 0x08,
    /** bit 2: XMP metadata present (XMP chunk) */
    XMP: 0x04,
    /** bit 1: Animation control present (ANIM/ANMF chunks) */
    ANIMATION: 0x02,
} as const;

/** Sizing and format constants */
export const RIFF_HEADER_SIZE = 12;
export const CHUNK_HEADER_SIZE = 8;
export const VP8X_PAYLOAD_SIZE = 10;
export const DEFAULT_WEBP_QUALITY = 0.95;
export const MIME_TYPE_WEBP = 'image/webp' as const;
export const MIME_TYPE_PNG = 'image/png' as const;

// ============================================================================
// 2. Types & Interfaces
// ============================================================================

/** Options for merging WebP / image blobs */
export interface WebPMergeOptions {
    /** Target WebP compression quality between 0.01 and 1.0 (default: 0.95) */
    quality?: number;
    /** Whether to run browser-image-compression inside a Web Worker (default: true) */
    useWebWorker?: boolean;
    /** Whether to fallback to returning the lossless merged PNG if WebP conversion fails (default: true) */
    fallbackToPNG?: boolean;
    /** Optional progress notification callback */
    onProgress?: (message: string) => void;
}

/** Represents a parsed WebP RIFF chunk */
export interface WebPChunk {
    /** 4-character chunk identifier */
    fourCC: string;
    /** Raw payload byte length (excluding header and padding) */
    payloadSize: number;
    /** Padded payload byte length (aligned to 2 bytes) */
    paddedSize: number;
    /** Offset where the chunk header begins */
    headerOffset: number;
    /** Offset where the chunk payload begins */
    payloadOffset: number;
    /** Chunk payload byte data */
    data: Uint8Array;
}

/** Container metadata and extracted attributes of a WebP file */
export interface WebPContainerInfo {
    /** Whether the file is a valid RIFF/WEBP container */
    isValid: boolean;
    /** Total container file size declared in RIFF header */
    fileSize: number;
    /** Canvas width in pixels (if extractable) */
    width?: number;
    /** Canvas height in pixels (if extractable) */
    height?: number;
    /** Whether image has alpha transparency */
    hasAlpha?: boolean;
    /** Whether image contains animation frames */
    hasAnimation?: boolean;
    /** Whether image contains EXIF metadata */
    hasExif?: boolean;
    /** Whether image contains XMP metadata */
    hasXmp?: boolean;
    /** Whether image contains ICC color profile */
    hasIccp?: boolean;
    /** List of all parsed chunks in order */
    chunks: WebPChunk[];
}

/** Options for constructing a VP8X chunk */
export interface VP8XChunkOptions {
    width: number;
    height: number;
    hasIcc?: boolean;
    hasAlpha?: boolean;
    hasExif?: boolean;
    hasXmp?: boolean;
    hasAnimation?: boolean;
}

// ============================================================================
// 3. Binary Helpers & Parsing Utilities
// ============================================================================

/**
 * Reads a 4-character ASCII code (FourCC) from a Uint8Array at the specified offset.
 */
export function readFourCC(data: Uint8Array, offset: number): string {
    if (offset + 4 > data.length) return '';
    return String.fromCharCode(
        data[offset],
        data[offset + 1],
        data[offset + 2],
        data[offset + 3]
    );
}

/**
 * Writes a 4-character ASCII code (FourCC) into a DataView at the specified offset.
 */
export function writeFourCC(view: DataView, offset: number, fourCC: string): void {
    for (let i = 0; i < 4; i++) {
        view.setUint8(offset + i, fourCC.charCodeAt(i));
    }
}

/**
 * Reads a 24-bit unsigned integer in Little-Endian byte order.
 */
export function readUint24LE(data: Uint8Array | DataView, offset: number): number {
    if (data instanceof DataView) {
        return data.getUint8(offset) | (data.getUint8(offset + 1) << 8) | (data.getUint8(offset + 2) << 16);
    }
    return data[offset] | (data[offset + 1] << 8) | (data[offset + 2] << 16);
}

/**
 * Writes a 24-bit unsigned integer in Little-Endian byte order.
 */
export function writeUint24LE(view: DataView, offset: number, value: number): void {
    const clamped = Math.max(0, Math.min(0xffffff, Math.round(value)));
    view.setUint8(offset, clamped & 0xff);
    view.setUint8(offset + 1, (clamped >> 8) & 0xff);
    view.setUint8(offset + 2, (clamped >> 16) & 0xff);
}

/**
 * Parses a WebP RIFF container, extracting its chunks, dimensions, and metadata flags.
 *
 * @param input - ArrayBuffer or Uint8Array containing WebP binary data
 * @returns Parsed WebP container information
 */
export function parseWebPContainer(input: ArrayBuffer | Uint8Array): WebPContainerInfo {
    const bytes = input instanceof Uint8Array ? input : new Uint8Array(input);
    const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);

    const emptyResult: WebPContainerInfo = {
        isValid: false,
        fileSize: 0,
        chunks: [],
    };

    if (bytes.byteLength < RIFF_HEADER_SIZE) {
        return emptyResult;
    }

    const riff = readFourCC(bytes, 0);
    const webp = readFourCC(bytes, 8);
    if (riff !== FOURCC_RIFF || webp !== FOURCC_WEBP) {
        return emptyResult;
    }

    const declaredFileSize = view.getUint32(4, true) + 8;
    const result: WebPContainerInfo = {
        isValid: true,
        fileSize: declaredFileSize,
        chunks: [],
    };

    let offset = RIFF_HEADER_SIZE;

    while (offset + CHUNK_HEADER_SIZE <= bytes.byteLength) {
        const chunkFourCC = readFourCC(bytes, offset);
        const payloadSize = view.getUint32(offset + 4, true);
        const paddedSize = payloadSize + (payloadSize % 2);
        const payloadOffset = offset + CHUNK_HEADER_SIZE;

        if (payloadOffset + payloadSize > bytes.byteLength) {
            // Truncated chunk
            break;
        }

        const chunkData = bytes.subarray(payloadOffset, payloadOffset + payloadSize);
        result.chunks.push({
            fourCC: chunkFourCC,
            payloadSize,
            paddedSize,
            headerOffset: offset,
            payloadOffset,
            data: chunkData,
        });

        // Parse extended VP8X header
        if (chunkFourCC === FOURCC_VP8X && payloadSize >= VP8X_PAYLOAD_SIZE) {
            const flags = bytes[payloadOffset];
            result.hasIccp = Boolean(flags & VP8X_FLAGS.ICC);
            result.hasAlpha = Boolean(flags & VP8X_FLAGS.ALPHA);
            result.hasExif = Boolean(flags & VP8X_FLAGS.EXIF);
            result.hasXmp = Boolean(flags & VP8X_FLAGS.XMP);
            result.hasAnimation = Boolean(flags & VP8X_FLAGS.ANIMATION);

            // Canvas width and height (24-bit LE, actual = value + 1)
            result.width = readUint24LE(bytes, payloadOffset + 4) + 1;
            result.height = readUint24LE(bytes, payloadOffset + 7) + 1;
        }

        // Parse lossless VP8L header if VP8X was not present
        if (chunkFourCC === FOURCC_VP8L && !result.width && payloadSize >= 5) {
            const sig = chunkData[0];
            if (sig === 0x2f) {
                const b0 = chunkData[1];
                const b1 = chunkData[2];
                const b2 = chunkData[3];
                const b3 = chunkData[4];
                result.width = (b0 | ((b1 & 0x3f) << 8)) + 1;
                result.height = (((b1 >> 6) & 0x03) | (b2 << 2) | ((b3 & 0x0f) << 10)) + 1;
                result.hasAlpha = Boolean((b3 & 0x10) >> 4);
            }
        }

        // Parse lossy VP8 header if VP8X was not present
        if (chunkFourCC === FOURCC_VP8 && !result.width && payloadSize >= 10) {
            // Keyframe code: 0x9D 0x01 0x2A
            if (chunkData[3] === 0x9d && chunkData[4] === 0x01 && chunkData[5] === 0x2a) {
                result.width = (chunkData[6] | (chunkData[7] << 8)) & 0x3fff;
                result.height = (chunkData[8] | (chunkData[9] << 8)) & 0x3fff;
            }
        }

        if (chunkFourCC === FOURCC_ALPH) {
            result.hasAlpha = true;
        } else if (chunkFourCC === FOURCC_ANIM || chunkFourCC === FOURCC_ANMF) {
            result.hasAnimation = true;
        } else if (chunkFourCC === FOURCC_EXIF) {
            result.hasExif = true;
        } else if (chunkFourCC === FOURCC_XMP) {
            result.hasXmp = true;
        } else if (chunkFourCC === FOURCC_ICCP) {
            result.hasIccp = true;
        }

        offset += CHUNK_HEADER_SIZE + paddedSize;
    }

    return result;
}

// ============================================================================
// 4. WebP Chunk Builders & Assembly
// ============================================================================

/**
 * Creates the standard 12-byte RIFF WebP container header.
 *
 * @param payloadSize - Total size of all subsequent chunks (fileSize - 8)
 */
export function createRIFFHeader(payloadSize: number = 0): ArrayBuffer {
    const buffer = new ArrayBuffer(RIFF_HEADER_SIZE);
    const view = new DataView(buffer);
    writeFourCC(view, 0, FOURCC_RIFF);
    view.setUint32(4, payloadSize, true);
    writeFourCC(view, 8, FOURCC_WEBP);
    return buffer;
}

/**
 * Creates an 18-byte VP8X extended WebP header chunk.
 */
export function createVP8XChunk(options: VP8XChunkOptions): ArrayBuffer {
    const {
        width,
        height,
        hasIcc = false,
        hasAlpha = false,
        hasExif = false,
        hasXmp = false,
        hasAnimation = false,
    } = options;

    const totalChunkLength = CHUNK_HEADER_SIZE + VP8X_PAYLOAD_SIZE;
    const buffer = new ArrayBuffer(totalChunkLength);
    const view = new DataView(buffer);

    writeFourCC(view, 0, FOURCC_VP8X);
    view.setUint32(4, VP8X_PAYLOAD_SIZE, true);

    let flags = 0;
    if (hasIcc) flags |= VP8X_FLAGS.ICC;
    if (hasAlpha) flags |= VP8X_FLAGS.ALPHA;
    if (hasExif) flags |= VP8X_FLAGS.EXIF;
    if (hasXmp) flags |= VP8X_FLAGS.XMP;
    if (hasAnimation) flags |= VP8X_FLAGS.ANIMATION;

    view.setUint8(8, flags);
    view.setUint8(9, 0);  // Reserved
    view.setUint8(10, 0); // Reserved
    view.setUint8(11, 0); // Reserved

    // Canvas width - 1 and height - 1 (24-bit Little-Endian)
    writeUint24LE(view, 12, Math.max(0, width - 1));
    writeUint24LE(view, 15, Math.max(0, height - 1));

    return buffer;
}

/**
 * Creates a generic metadata chunk (e.g. EXIF, XMP, ICCP) with correct alignment padding.
 *
 * @param fourCC - 4-character chunk identifier ('EXIF', 'XMP ', 'ICCP')
 * @param data - Raw metadata payload bytes
 */
export function createMetadataChunk(fourCC: string, data: Uint8Array): ArrayBuffer {
    const payloadSize = data.byteLength;
    const isOdd = payloadSize % 2 !== 0;
    const totalChunkLength = CHUNK_HEADER_SIZE + payloadSize + (isOdd ? 1 : 0);
    const buffer = new ArrayBuffer(totalChunkLength);
    const view = new DataView(buffer);

    writeFourCC(view, 0, fourCC);
    view.setUint32(4, payloadSize, true);
    new Uint8Array(buffer, CHUNK_HEADER_SIZE, payloadSize).set(data);

    if (isOdd) {
        view.setUint8(CHUNK_HEADER_SIZE + payloadSize, 0);
    }

    return buffer;
}

/**
 * Combines chunk buffers into a single RIFF WebP binary buffer, updating the container size.
 *
 * @param chunks - Sequence of WebP chunks (excluding the RIFF header)
 */
export function assembleWebPChunks(chunks: (ArrayBuffer | Uint8Array)[]): Uint8Array {
    let totalPayloadSize = 0;
    for (const chunk of chunks) {
        totalPayloadSize += chunk.byteLength;
    }

    const totalFileSize = RIFF_HEADER_SIZE + totalPayloadSize;
    const result = new Uint8Array(totalFileSize);
    const view = new DataView(result.buffer, result.byteOffset, result.byteLength);

    writeFourCC(view, 0, FOURCC_RIFF);
    view.setUint32(4, totalFileSize - 8, true);
    writeFourCC(view, 8, FOURCC_WEBP);

    let offset = RIFF_HEADER_SIZE;
    for (const chunk of chunks) {
        const chunkBytes = chunk instanceof Uint8Array ? chunk : new Uint8Array(chunk);
        result.set(chunkBytes, offset);
        offset += chunkBytes.byteLength;
    }

    return result;
}

// ============================================================================
// 5. Image Format Conversion Helpers
// ============================================================================

/**
 * Ensures an image blob is in PNG format for lossless binary merging.
 * If already PNG, returns it directly; otherwise renders onto canvas and converts.
 */
async function ensurePngBlob(blob: Blob, index: number): Promise<Blob> {
    if (blob.type === MIME_TYPE_PNG) {
        return blob;
    }

    console.log(`[WebP Merge] Converting image ${index + 1} (${blob.type || 'unknown'}) to PNG...`);
    const canvas = await loadImageBlobToCanvas(blob);
    return await canvasToBlob(canvas, MIME_TYPE_PNG);
}

/**
 * Converts a PNG blob to WebP using browser-image-compression.
 */
async function convertPngToWebp(
    pngBlob: Blob,
    options: WebPMergeOptions = {}
): Promise<Blob> {
    const {
        quality = DEFAULT_WEBP_QUALITY,
        useWebWorker = true,
        onProgress,
    } = options;

    onProgress?.('WebP 이미지 압축 및 인코딩 중...');
    console.log(`[WebP Merge] Converting PNG to WebP (quality: ${quality}, useWebWorker: ${useWebWorker})...`);

    const pngFile = new File([pngBlob], 'merged.png', {
        type: pngBlob.type || MIME_TYPE_PNG,
        lastModified: Date.now(),
    });

    const compressionOptions = {
        initialQuality: Math.min(Math.max(quality, 0.01), 1.0),
        fileType: MIME_TYPE_WEBP,
        useWebWorker,
    };

    const webpBlob = await imageCompression(pngFile, compressionOptions);

    const originalSize = pngBlob.size;
    const finalSize = webpBlob.size;
    const compressionRatio = originalSize > 0
        ? ((1 - finalSize / originalSize) * 100).toFixed(1)
        : '0.0';

    console.log(`[WebP Merge] Original PNG size: ${originalSize} bytes`);
    console.log(`[WebP Merge] Final WebP size: ${finalSize} bytes`);
    console.log(`[WebP Merge] Compression reduction: ${compressionRatio}%`);

    return webpBlob;
}

// ============================================================================
// 6. Public WebP Binary Merging API
// ============================================================================

/**
 * Merges multiple WebP / image blobs into a single vertically concatenated WebP image.
 *
 * Strategy:
 * 1. Normalize all input blobs to PNG format (lossless intermediate representation).
 * 2. Perform lossless binary PNG vertical merging without Canvas dimension limits.
 * 3. Encode the merged PNG into WebP via browser-image-compression with Worker support.
 * 4. Fall back safely to the lossless merged PNG if WebP encoding encounters an issue.
 *
 * @param blobs - Array of image Blobs to merge
 * @param options - Optional merge and compression configuration
 * @returns Promise resolving to the merged WebP Blob (or PNG fallback)
 */
export const mergeWebPsBinary = async (
    blobs: Blob[],
    options: WebPMergeOptions = {}
): Promise<Blob> => {
    if (!blobs || blobs.length === 0) {
        throw new Error('[WebP Merge] No image blobs provided for merging.');
    }

    const {
        fallbackToPNG = true,
        onProgress,
    } = options;

    console.log(`[WebP Merge] Starting WebP merge for ${blobs.length} images...`);
    console.log(`[WebP Merge] Strategy: PNG binary merge → browser-image-compression WebP encoding`);

    // Fast-path: single image optimization
    if (blobs.length === 1 && blobs[0].type === MIME_TYPE_WEBP) {
        console.log('[WebP Merge] Single WebP image detected, returning directly.');
        return blobs[0];
    }

    // Step 1: Normalize all images to PNG
    onProgress?.(`이미지 ${blobs.length}개 변환 준비 중...`);
    const pngBlobs: Blob[] = [];
    for (let i = 0; i < blobs.length; i++) {
        const blob = blobs[i];
        console.log(`[WebP Merge] Image ${i + 1}/${blobs.length}: ${blob.type || 'unknown type'}`);
        const pngBlob = await ensurePngBlob(blob, i);
        pngBlobs.push(pngBlob);
    }

    // Step 2: Binary PNG Merge (Canvas-free, unrestricted height)
    onProgress?.('PNG 바이너리 무제한 크기 병합 중...');
    console.log(`[WebP Merge] Merging ${pngBlobs.length} PNGs using binary merge (no canvas size limit)...`);
    const mergedPNG = await mergePNGsBinary(pngBlobs);
    console.log(`[WebP Merge] Merged PNG size: ${mergedPNG.size} bytes`);

    // Step 3: WebP Compression & Encoding
    try {
        return await convertPngToWebp(mergedPNG, options);
    } catch (error) {
        console.error('[WebP Merge] browser-image-compression failed:', error);

        if (fallbackToPNG) {
            console.warn('[WebP Merge] Fallback: Returning lossless merged PNG instead of WebP');
            console.log('[WebP Merge] Note: PNG has no canvas size limits and preserves 100% quality');
            return mergedPNG;
        }

        throw error;
    }
};
