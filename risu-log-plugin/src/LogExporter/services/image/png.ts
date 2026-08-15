/**
 * PNG Binary Manipulation & Encoding Utilities
 *
 * Provides high-performance, canvas-free binary PNG decoding, filter reconstruction,
 * vertical image merging, chunk generation, and metadata embedding (tEXt / iTXt).
 */

import pako from 'pako';

// ==========================================
// Constants & Types
// ==========================================

/** Standard 8-byte PNG file magic header */
export const PNG_SIGNATURE = new Uint8Array([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]);

/** PNG Color Type values defined in ISO/IEC 15948 */
export const PNG_COLOR_TYPE = {
    GRAYSCALE: 0,
    RGB: 2,
    INDEXED: 3,
    GRAYSCALE_ALPHA: 4,
    RGBA: 6,
} as const;

export type PngColorType = (typeof PNG_COLOR_TYPE)[keyof typeof PNG_COLOR_TYPE];

/** PNG Scanline Filter Types */
export const PNG_FILTER_TYPE = {
    NONE: 0,
    SUB: 1,
    UP: 2,
    AVERAGE: 3,
    PAETH: 4,
} as const;

export type PngFilterType = (typeof PNG_FILTER_TYPE)[keyof typeof PNG_FILTER_TYPE];

/** Parsed PNG Header (IHDR chunk data) */
export interface PngIhdrInfo {
    width: number;
    height: number;
    bitDepth: number;
    colorType: number;
    compression: number;
    filter: number;
    interlace: number;
    bytesPerPixel: number;
}

/** Options for embedding internationalized text metadata (iTXt) */
export interface InternationalTextOptions {
    languageTag?: string;
    translatedKeyword?: string;
    compressed?: boolean;
}

// ==========================================
// CRC32 Utilities
// ==========================================

/** Pre-computed CRC32 table for fast polynomial lookup */
const CRC32_TABLE: Uint32Array = (() => {
    const table = new Uint32Array(256);
    for (let i = 0; i < 256; i++) {
        let c = i;
        for (let k = 0; k < 8; k++) {
            c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1);
        }
        table[i] = c >>> 0;
    }
    return table;
})();

/**
 * Calculates standard IEEE 802.3 32-bit Cyclic Redundancy Check (CRC32).
 *
 * @param data Byte array over which CRC is calculated
 * @returns 32-bit unsigned integer CRC value
 */
export function calculateCrc32(data: Uint8Array): number {
    let crc = -1;
    for (let i = 0; i < data.length; i++) {
        crc = (crc >>> 8) ^ CRC32_TABLE[(crc ^ data[i]) & 0xFF];
    }
    return (crc ^ -1) >>> 0;
}

// ==========================================
// PNG Chunk Creation & Manipulation
// ==========================================

/**
 * Creates a raw binary PNG chunk: [Length (4B)][Type (4B)][Data (NB)][CRC (4B)].
 *
 * @param type 4-character ASCII chunk type (e.g., 'IHDR', 'IDAT', 'tEXt', 'IEND')
 * @param data Byte buffer containing chunk payload
 * @returns Complete encoded chunk byte array
 */
export function createPNGChunk(type: string, data: Uint8Array): Uint8Array {
    if (type.length !== 4) {
        throw new Error(`Invalid PNG chunk type: "${type}". Chunk types must be exactly 4 characters.`);
    }

    const typeEncoder = new TextEncoder();
    const typeBytes = typeEncoder.encode(type);
    const dataLength = data.length;
    const chunkLength = 12 + dataLength; // 4 (length) + 4 (type) + dataLength + 4 (crc)

    const chunk = new Uint8Array(chunkLength);
    const view = new DataView(chunk.buffer, chunk.byteOffset, chunk.byteLength);

    // 1. Chunk Length (4 bytes, Big-Endian)
    view.setUint32(0, dataLength, false);

    // 2. Chunk Type (4 bytes)
    chunk.set(typeBytes, 4);

    // 3. Chunk Data (N bytes)
    if (dataLength > 0) {
        chunk.set(data, 8);
    }

    // 4. CRC-32 (4 bytes, Big-Endian) computed over Type + Data
    const crcTarget = chunk.subarray(4, 8 + dataLength);
    const crc = calculateCrc32(crcTarget);
    view.setUint32(8 + dataLength, crc, false);

    return chunk;
}

/**
 * Creates a PNG `tEXt` chunk for Latin-1 / UTF-8 key-value metadata.
 *
 * @param keyword Keyword descriptor (1-79 characters)
 * @param text Text value associated with the keyword
 */
export function createPngTextChunk(keyword: string, text: string): Uint8Array {
    const encoder = new TextEncoder();
    const keywordBytes = encoder.encode(keyword);
    const textBytes = encoder.encode(text);

    // Layout: [Keyword][0x00 Null Separator][Text]
    const payload = new Uint8Array(keywordBytes.length + 1 + textBytes.length);
    payload.set(keywordBytes, 0);
    payload[keywordBytes.length] = 0x00;
    payload.set(textBytes, keywordBytes.length + 1);

    return createPNGChunk('tEXt', payload);
}

/**
 * Creates a PNG `iTXt` chunk for internationalized UTF-8 metadata.
 *
 * @param keyword Keyword descriptor (1-79 characters)
 * @param text Text string (UTF-8)
 * @param options Optional internationalization and compression settings
 */
export function createPngInternationalTextChunk(
    keyword: string,
    text: string,
    options: InternationalTextOptions = {}
): Uint8Array {
    const encoder = new TextEncoder();
    const keywordBytes = encoder.encode(keyword);
    const langBytes = encoder.encode(options.languageTag ?? '');
    const translatedKwBytes = encoder.encode(options.translatedKeyword ?? '');

    const rawTextBytes = encoder.encode(text);
    const isCompressed = Boolean(options.compressed);
    const textPayload = isCompressed ? pako.deflate(rawTextBytes) : rawTextBytes;

    // Layout: [Keyword]\0 [CompFlag:1B] [CompMethod:1B] [LangTag]\0 [TransKeyword]\0 [Text]
    const payloadLength =
        keywordBytes.length + 1 +
        1 +
        1 +
        langBytes.length + 1 +
        translatedKwBytes.length + 1 +
        textPayload.length;

    const payload = new Uint8Array(payloadLength);
    let offset = 0;

    payload.set(keywordBytes, offset);
    offset += keywordBytes.length;
    payload[offset++] = 0x00;

    payload[offset++] = isCompressed ? 1 : 0;
    payload[offset++] = 0; // Deflate compression method

    payload.set(langBytes, offset);
    offset += langBytes.length;
    payload[offset++] = 0x00;

    payload.set(translatedKwBytes, offset);
    offset += translatedKwBytes.length;
    payload[offset++] = 0x00;

    payload.set(textPayload, offset);

    return createPNGChunk('iTXt', payload);
}

/**
 * Injects metadata key-value pairs as `tEXt` chunks into a PNG binary right after the IHDR chunk.
 *
 * @param pngBuffer Original PNG file buffer (ArrayBuffer or Uint8Array)
 * @param metadata Key-value pairs of metadata to embed
 * @returns New Uint8Array containing the PNG with embedded metadata
 */
export function embedPngMetadata(
    pngBuffer: ArrayBuffer | Uint8Array,
    metadata: Record<string, string>
): Uint8Array {
    const uint8 = pngBuffer instanceof Uint8Array ? pngBuffer : new Uint8Array(pngBuffer);
    if (!isPng(uint8)) {
        throw new Error('Cannot embed metadata: input is not a valid PNG.');
    }

    const entries = Object.entries(metadata);
    if (entries.length === 0) {
        return uint8;
    }

    const metadataChunks = entries.map(([key, value]) => createPngTextChunk(key, value));
    const metadataTotalLength = metadataChunks.reduce((sum, chunk) => sum + chunk.byteLength, 0);

    // PNG signature (8B) + IHDR chunk (12B + 13B = 25B) = 33B
    const ihdrEndOffset = 8 + 25;
    if (uint8.byteLength < ihdrEndOffset) {
        throw new Error('Corrupted PNG: buffer smaller than PNG header.');
    }

    const result = new Uint8Array(uint8.byteLength + metadataTotalLength);

    // Copy Signature + IHDR
    result.set(uint8.subarray(0, ihdrEndOffset), 0);
    let currentOffset = ihdrEndOffset;

    // Insert metadata chunks
    for (const chunk of metadataChunks) {
        result.set(chunk, currentOffset);
        currentOffset += chunk.byteLength;
    }

    // Copy remaining chunks (IDAT, IEND, etc.)
    result.set(uint8.subarray(ihdrEndOffset), currentOffset);

    return result;
}

/**
 * Reads all `tEXt` key-value pairs from a PNG file buffer.
 *
 * @param buffer PNG file buffer
 * @returns Record containing extracted metadata key-value pairs
 */
export function extractPngMetadata(buffer: ArrayBuffer | Uint8Array): Record<string, string> {
    const uint8 = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer);
    if (!isPng(uint8)) {
        throw new Error('Cannot extract metadata: input is not a valid PNG.');
    }

    const view = new DataView(uint8.buffer, uint8.byteOffset, uint8.byteLength);
    const metadata: Record<string, string> = {};
    const decoder = new TextDecoder('latin1');

    let offset = 8; // Skip PNG signature
    while (offset + 12 <= uint8.byteLength) {
        const length = view.getUint32(offset, false);
        const type = String.fromCharCode(
            uint8[offset + 4],
            uint8[offset + 5],
            uint8[offset + 6],
            uint8[offset + 7]
        );

        if (type === 'tEXt') {
            const chunkData = uint8.subarray(offset + 8, offset + 8 + length);
            const nullIndex = chunkData.indexOf(0x00);
            if (nullIndex !== -1) {
                const key = decoder.decode(chunkData.subarray(0, nullIndex));
                const text = decoder.decode(chunkData.subarray(nullIndex + 1));
                metadata[key] = text;
            }
        }

        if (type === 'IEND') {
            break;
        }

        offset += 12 + length;
    }

    return metadata;
}

// ==========================================
// PNG Validation & Header Parsing
// ==========================================

/**
 * Checks whether the given buffer starts with the standard 8-byte PNG signature.
 */
export function isPng(buffer: ArrayBuffer | Uint8Array): boolean {
    const bytes = buffer instanceof Uint8Array
        ? buffer
        : new Uint8Array(buffer, 0, Math.min(buffer.byteLength, 8));

    if (bytes.length < 8) return false;
    for (let i = 0; i < 8; i++) {
        if (bytes[i] !== PNG_SIGNATURE[i]) return false;
    }
    return true;
}

/**
 * Calculates bytes per pixel for a given color type and bit depth.
 */
export function getBytesPerPixel(colorType: number, bitDepth: number): number {
    switch (colorType) {
        case PNG_COLOR_TYPE.GRAYSCALE:
            return Math.max(1, Math.ceil(bitDepth / 8));
        case PNG_COLOR_TYPE.RGB:
            return Math.max(1, Math.ceil((bitDepth * 3) / 8));
        case PNG_COLOR_TYPE.INDEXED:
            return 1;
        case PNG_COLOR_TYPE.GRAYSCALE_ALPHA:
            return Math.max(1, Math.ceil((bitDepth * 2) / 8));
        case PNG_COLOR_TYPE.RGBA:
            return Math.max(1, Math.ceil((bitDepth * 4) / 8));
        default:
            return 4; // Fallback to RGBA 4bpp
    }
}

/**
 * Parses and validates the IHDR chunk from a PNG file buffer.
 *
 * @param buffer ArrayBuffer or Uint8Array of the PNG file
 * @returns Parsed IHDR properties
 */
export function parsePngIhdr(buffer: ArrayBuffer | Uint8Array): PngIhdrInfo {
    const uint8 = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer);

    if (uint8.byteLength < 33) {
        throw new Error(`Invalid PNG: Buffer too small (${uint8.byteLength} bytes). Expected at least 33 bytes for header.`);
    }

    if (!isPng(uint8)) {
        throw new Error('Invalid PNG: Missing valid 8-byte PNG signature.');
    }

    const view = new DataView(uint8.buffer, uint8.byteOffset, uint8.byteLength);
    const ihdrLength = view.getUint32(8, false);
    const ihdrType = String.fromCharCode(uint8[12], uint8[13], uint8[14], uint8[15]);

    if (ihdrType !== 'IHDR' || ihdrLength !== 13) {
        throw new Error(`Invalid PNG: Expected IHDR chunk at offset 8, found "${ihdrType}" (length: ${ihdrLength}).`);
    }

    const width = view.getUint32(16, false);
    const height = view.getUint32(20, false);
    const bitDepth = uint8[24];
    const colorType = uint8[25];
    const compression = uint8[26];
    const filter = uint8[27];
    const interlace = uint8[28];

    const bytesPerPixel = getBytesPerPixel(colorType, bitDepth);

    return {
        width,
        height,
        bitDepth,
        colorType,
        compression,
        filter,
        interlace,
        bytesPerPixel,
    };
}

// ==========================================
// Scanline Filter Algorithms
// ==========================================

/**
 * Computes the Paeth predictor value according to PNG specification RFC 2083.
 *
 * @param a Left pixel value
 * @param b Above pixel value
 * @param c Upper-left pixel value
 */
export function paethPredictor(a: number, b: number, c: number): number {
    const p = a + b - c;
    const pa = Math.abs(p - a);
    const pb = Math.abs(p - b);
    const pc = Math.abs(p - c);

    if (pa <= pb && pa <= pc) return a;
    if (pb <= pc) return b;
    return c;
}

/**
 * Reconstructs raw pixel data by decoding PNG scanline filters (None, Sub, Up, Average, Paeth).
 *
 * @param filteredData Decompressed raw filtered scanlines with leading filter byte per row
 * @param width Image width in pixels
 * @param height Image height in pixels
 * @param bytesPerPixel Bytes per pixel (e.g. 4 for RGBA 8-bit)
 * @returns Reconstructed raw pixel buffer without filter prefix bytes
 */
export function decodePngFilters(
    filteredData: Uint8Array,
    width: number,
    height: number,
    bytesPerPixel: number
): Uint8Array {
    const bytesPerLine = width * bytesPerPixel;
    const bytesPerScanline = 1 + bytesPerLine;
    const decoded = new Uint8Array(height * bytesPerLine);

    for (let y = 0; y < height; y++) {
        const filterType = filteredData[y * bytesPerScanline];
        const scanlineStart = y * bytesPerScanline + 1; // Skip 1 filter byte
        const scanline = filteredData.subarray(scanlineStart, scanlineStart + bytesPerLine);
        const decodedStart = y * bytesPerLine;

        switch (filterType) {
            case PNG_FILTER_TYPE.NONE: {
                decoded.set(scanline, decodedStart);
                break;
            }

            case PNG_FILTER_TYPE.SUB: {
                for (let x = 0; x < bytesPerLine; x++) {
                    const left = x >= bytesPerPixel ? decoded[decodedStart + x - bytesPerPixel] : 0;
                    decoded[decodedStart + x] = (scanline[x] + left) & 0xFF;
                }
                break;
            }

            case PNG_FILTER_TYPE.UP: {
                for (let x = 0; x < bytesPerLine; x++) {
                    const up = y > 0 ? decoded[decodedStart - bytesPerLine + x] : 0;
                    decoded[decodedStart + x] = (scanline[x] + up) & 0xFF;
                }
                break;
            }

            case PNG_FILTER_TYPE.AVERAGE: {
                for (let x = 0; x < bytesPerLine; x++) {
                    const left = x >= bytesPerPixel ? decoded[decodedStart + x - bytesPerPixel] : 0;
                    const up = y > 0 ? decoded[decodedStart - bytesPerLine + x] : 0;
                    decoded[decodedStart + x] = (scanline[x] + ((left + up) >> 1)) & 0xFF;
                }
                break;
            }

            case PNG_FILTER_TYPE.PAETH: {
                for (let x = 0; x < bytesPerLine; x++) {
                    const left = x >= bytesPerPixel ? decoded[decodedStart + x - bytesPerPixel] : 0;
                    const up = y > 0 ? decoded[decodedStart - bytesPerLine + x] : 0;
                    const upLeft = (y > 0 && x >= bytesPerPixel)
                        ? decoded[decodedStart - bytesPerLine + x - bytesPerPixel]
                        : 0;
                    decoded[decodedStart + x] = (scanline[x] + paethPredictor(left, up, upLeft)) & 0xFF;
                }
                break;
            }

            default:
                throw new Error(`Unsupported PNG filter type (${filterType}) at scanline ${y}.`);
        }
    }

    return decoded;
}

/**
 * Encodes raw pixel data by prepending Filter 0 (None) to each scanline.
 *
 * @param pixelData Raw uncompressed pixel buffer
 * @param width Image width in pixels
 * @param height Image height in pixels
 * @param bytesPerPixel Bytes per pixel
 * @returns Scanline-encoded byte array ready for zlib compression
 */
export function encodePngWithNoFilter(
    pixelData: Uint8Array,
    width: number,
    height: number,
    bytesPerPixel: number
): Uint8Array {
    const bytesPerLine = width * bytesPerPixel;
    const scanlineLength = 1 + bytesPerLine;
    const encoded = new Uint8Array(height * scanlineLength);

    for (let y = 0; y < height; y++) {
        const dstOffset = y * scanlineLength;
        encoded[dstOffset] = PNG_FILTER_TYPE.NONE; // Filter type 0 (None)

        const srcStart = y * bytesPerLine;
        encoded.set(pixelData.subarray(srcStart, srcStart + bytesPerLine), dstOffset + 1);
    }

    return encoded;
}

// ==========================================
// Binary Extraction Helpers
// ==========================================

/**
 * Extracts all IDAT chunk payloads from a PNG buffer.
 */
export function extractIdatChunks(buffer: ArrayBuffer | Uint8Array): Uint8Array[] {
    const uint8 = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer);
    const view = new DataView(uint8.buffer, uint8.byteOffset, uint8.byteLength);
    const idatChunks: Uint8Array[] = [];

    let offset = 8; // Skip 8-byte PNG signature
    while (offset + 12 <= uint8.byteLength) {
        const length = view.getUint32(offset, false);
        const type = String.fromCharCode(
            uint8[offset + 4],
            uint8[offset + 5],
            uint8[offset + 6],
            uint8[offset + 7]
        );

        if (type === 'IDAT') {
            const chunkData = uint8.subarray(offset + 8, offset + 8 + length);
            idatChunks.push(chunkData);
        }

        if (type === 'IEND') {
            break;
        }

        offset += 12 + length;
    }

    return idatChunks;
}

/**
 * Concatenates an array of byte arrays into a single contiguous Uint8Array.
 */
export function combineByteArrays(arrays: Uint8Array[]): Uint8Array {
    const totalLength = arrays.reduce((sum, arr) => sum + arr.byteLength, 0);
    const combined = new Uint8Array(totalLength);
    let currentOffset = 0;

    for (const arr of arrays) {
        combined.set(arr, currentOffset);
        currentOffset += arr.byteLength;
    }

    return combined;
}

// ==========================================
// Core Export: Vertical Binary PNG Merge
// ==========================================

/**
 * Merges multiple PNG images vertically directly at the binary level without HTML Canvas.
 *
 * Stacking images via binary filter reconstruction bypasses browser Canvas memory limits,
 * supports arbitrary pixel heights, and preserves original image fidelity.
 *
 * @param blobs Array of PNG Blob objects to merge vertically
 * @returns Single merged PNG Blob
 */
export const mergePNGsBinary = async (
    blobs: Blob[]
): Promise<Blob> => {
    if (blobs.length === 0) {
        throw new Error('No images to merge');
    }

    // Convert all PNG blobs to ArrayBuffers concurrently
    const buffers = await Promise.all(blobs.map(blob => blob.arrayBuffer()));

    // Parse header and layout specifications from the first image
    const firstHeader = parsePngIhdr(buffers[0]);
    const { width, bitDepth, colorType, compression, filter, interlace, bytesPerPixel } = firstHeader;
    const bytesPerScanline = 1 + (width * bytesPerPixel);

    console.log(
        `[PNG Merge] Merging ${buffers.length} images. Width: ${width}, ColorType: ${colorType}, ` +
        `BitDepth: ${bitDepth}, BytesPerPixel: ${bytesPerPixel}, BytesPerScanline: ${bytesPerScanline}`
    );

    const allDecodedPixels: Uint8Array[] = [];
    let totalHeight = 0;

    for (let imgIdx = 0; imgIdx < buffers.length; imgIdx++) {
        const buffer = buffers[imgIdx];
        const header = parsePngIhdr(buffer);

        if (header.width !== width) {
            console.warn(
                `[PNG Merge] Image ${imgIdx + 1} width (${header.width}) does not match first image width (${width}).`
            );
        }

        totalHeight += header.height;
        console.log(`[PNG Merge] Image ${imgIdx + 1}: height=${header.height}`);

        const idatChunks = extractIdatChunks(buffer);
        if (idatChunks.length === 0) {
            throw new Error(`[PNG Merge] Image ${imgIdx + 1} contains no IDAT chunks.`);
        }

        const combinedIdat = combineByteArrays(idatChunks);

        try {
            const inflated = pako.inflate(combinedIdat);
            if (!inflated) {
                throw new Error(`pako.inflate returned empty data for image ${imgIdx + 1}.`);
            }

            const expectedSize = header.height * bytesPerScanline;
            if (inflated.length !== expectedSize) {
                console.warn(
                    `[PNG Merge] Image ${imgIdx + 1}: Expected ${expectedSize} bytes, got ${inflated.length} bytes`
                );
            }

            console.log(`[PNG Merge] Decoding filters for image ${imgIdx + 1}...`);
            const decodedPixels = decodePngFilters(inflated, width, header.height, bytesPerPixel);
            allDecodedPixels.push(decodedPixels);
        } catch (error) {
            console.error(`[PNG Merge] Failed to inflate/decode image ${imgIdx + 1}:`, error);
            throw error;
        }
    }

    // Concatenate all decoded pixel arrays
    const mergedPixelData = combineByteArrays(allDecodedPixels);
    console.log(`[PNG Merge] Total height: ${totalHeight}, Total raw pixel bytes: ${mergedPixelData.byteLength}`);

    // Encode scanlines with Filter 0 (None)
    console.log(`[PNG Merge] Encoding with no filter...`);
    const encodedData = encodePngWithNoFilter(mergedPixelData, width, totalHeight, bytesPerPixel);

    // Compress raw scanlines with zlib deflate level 9
    console.log(`[PNG Merge] Compressing merged data (${encodedData.length} bytes)...`);
    const compressed = pako.deflate(encodedData, { level: 9 });
    console.log(`[PNG Merge] Compressed size: ${compressed.length} bytes`);

    // Build new IHDR chunk with updated totalHeight
    const newIhdrData = new Uint8Array(13);
    const ihdrView = new DataView(newIhdrData.buffer, newIhdrData.byteOffset, newIhdrData.byteLength);
    ihdrView.setUint32(0, width, false);
    ihdrView.setUint32(4, totalHeight, false);
    newIhdrData[8] = bitDepth;
    newIhdrData[9] = colorType;
    newIhdrData[10] = compression;
    newIhdrData[11] = filter;
    newIhdrData[12] = interlace;

    const ihdrChunk = createPNGChunk('IHDR', newIhdrData);
    const idatChunk = createPNGChunk('IDAT', compressed);
    const iendChunk = createPNGChunk('IEND', new Uint8Array(0));

    // Assemble final PNG: Signature + IHDR + IDAT + IEND
    const totalLength = PNG_SIGNATURE.length + ihdrChunk.length + idatChunk.length + iendChunk.length;
    const finalPng = new Uint8Array(totalLength);

    let offset = 0;
    finalPng.set(PNG_SIGNATURE, offset);
    offset += PNG_SIGNATURE.length;
    finalPng.set(ihdrChunk, offset);
    offset += ihdrChunk.length;
    finalPng.set(idatChunk, offset);
    offset += idatChunk.length;
    finalPng.set(iendChunk, offset);

    console.log(`[PNG Merge] Final PNG size: ${totalLength} bytes`);

    return new Blob([finalPng], { type: 'image/png' });
};
