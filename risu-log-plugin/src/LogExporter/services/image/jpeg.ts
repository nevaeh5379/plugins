import jpeg from 'jpeg-js';

// ============================================================================
// Types & Interfaces
// ============================================================================

/**
 * Dimensions (width and height in pixels) of an image.
 */
export interface JPEGDimensions {
    width: number;
    height: number;
}

/**
 * Decoded JPEG image representation containing uncompressed RGBA pixel buffer
 * and extracted EXIF/comments metadata.
 */
export interface DecodedJPEG {
    /** Image width in pixels */
    width: number;
    /** Image height in pixels */
    height: number;
    /** Uncompressed RGBA pixel data (byte length = width * height * 4) */
    data: Uint8Array;
    /** Optional text comments embedded in JPEG COM markers */
    comments?: string[];
    /** Optional raw EXIF metadata buffer from APP1 marker */
    exifBuffer?: Uint8Array | Buffer;
}

/**
 * Options for encoding RGBA pixel data into JPEG binary format.
 */
export interface JPEGEncodeOptions {
    /** JPEG compression quality from 1 to 100 (default: 95) */
    quality?: number;
    /** Optional text comments to embed in JPEG COM markers */
    comments?: string[];
    /** Optional raw EXIF metadata buffer for APP1 marker */
    exifBuffer?: Uint8Array | Buffer;
}

/**
 * Configuration options for merging multiple JPEG blobs.
 */
export interface MergeJPEGsOptions {
    /** JPEG compression quality from 1 to 100 (default: 95) */
    quality?: number;
    /** Whether to preserve metadata (EXIF / comments) from source images (default: true) */
    preserveMetadata?: boolean;
}

// ============================================================================
// Constants
// ============================================================================

export const DEFAULT_JPEG_QUALITY = 95;
export const BYTES_PER_RGBA_PIXEL = 4;

const LOG_TAG = '[JPEG Merge]';
const JPEG_MIME_TYPE = 'image/jpeg';

// Internal types representing jpeg-js structures
interface JpegJSDecodedResult {
    width: number;
    height: number;
    data: Uint8Array;
    comments?: string[];
    exifBuffer?: Buffer | Uint8Array;
}

interface JpegJSEncodeData {
    data: Uint8Array | Buffer;
    width: number;
    height: number;
    comments?: string[];
    exifBuffer?: Uint8Array | Buffer;
}

interface JpegJSEncodeResult {
    data: Uint8Array | Buffer;
    width: number;
    height: number;
}

// ============================================================================
// Helper Utilities
// ============================================================================

/**
 * Decodes a raw JPEG binary buffer into an uncompressed RGBA pixel buffer
 * and extracts any embedded metadata (comments and EXIF buffer).
 *
 * @param buffer - JPEG binary data as a Uint8Array.
 * @returns Decoded JPEG representation containing dimensions, RGBA pixels, and metadata.
 */
export function decodeJPEG(buffer: Uint8Array): DecodedJPEG {
    const decodeOpts = {
        useTArray: true,
        formatAsRGBA: true,
        tolerantDecoding: true,
    };

    // jpeg-js decode accepts options object for typed array and RGBA format
    const decodeFn = jpeg.decode as unknown as (
        data: Uint8Array,
        opts: typeof decodeOpts
    ) => JpegJSDecodedResult;

    const decoded = decodeFn(buffer, decodeOpts);

    if (!decoded || !decoded.data || decoded.width <= 0 || decoded.height <= 0) {
        throw new Error('Failed to decode JPEG: invalid dimensions or missing pixel data');
    }

    return {
        width: decoded.width,
        height: decoded.height,
        data: decoded.data,
        comments: decoded.comments && decoded.comments.length > 0 ? decoded.comments : undefined,
        exifBuffer: decoded.exifBuffer,
    };
}

/**
 * Reads and decodes a JPEG Blob into a DecodedJPEG object.
 *
 * @param blob - The JPEG image blob to decode.
 * @param index - Optional index (for logging and error messages).
 * @returns Promise resolving to the DecodedJPEG object.
 */
export async function decodeJPEGBlob(blob: Blob, index?: number): Promise<DecodedJPEG> {
    const label = index !== undefined ? `image ${index + 1}` : 'image';
    try {
        const arrayBuffer = await blob.arrayBuffer();
        const uint8Array = new Uint8Array(arrayBuffer);
        const decoded = decodeJPEG(uint8Array);
        console.log(`${LOG_TAG} Decoded ${label}: ${decoded.width}x${decoded.height}`);
        return decoded;
    } catch (error) {
        console.error(`${LOG_TAG} Failed to decode ${label}:`, error);
        throw error;
    }
}

/**
 * Validates that all decoded images are non-empty and have matching widths,
 * returning the uniform width and total combined height.
 *
 * @param images - Array of decoded JPEG images.
 * @returns Combined dimensions { width, height }.
 */
export function validateDimensions(images: DecodedJPEG[]): JPEGDimensions {
    if (images.length === 0) {
        throw new Error('No images to merge');
    }

    const expectedWidth = images[0].width;
    let totalHeight = 0;

    for (let i = 0; i < images.length; i++) {
        const img = images[i];
        if (img.width !== expectedWidth) {
            throw new Error(
                `Image ${i + 1} has mismatched width: ${img.width}px (expected ${expectedWidth}px)`
            );
        }
        if (img.height <= 0) {
            throw new Error(`Image ${i + 1} has invalid height: ${img.height}px`);
        }
        totalHeight += img.height;
    }

    return { width: expectedWidth, height: totalHeight };
}

/**
 * Merges multiple decoded RGBA pixel buffers vertically into a single continuous buffer.
 *
 * @param images - Array of decoded JPEG images to stitch vertically.
 * @param totalWidth - Shared width of all images in pixels.
 * @param totalHeight - Total sum of all image heights in pixels.
 * @returns Combined RGBA pixel buffer (byte length = totalWidth * totalHeight * 4).
 */
export function mergePixelDataVertically(
    images: DecodedJPEG[],
    totalWidth: number,
    totalHeight: number
): Uint8Array {
    const bytesPerScanline = totalWidth * BYTES_PER_RGBA_PIXEL;
    const mergedData = new Uint8Array(totalWidth * totalHeight * BYTES_PER_RGBA_PIXEL);
    let currentY = 0;

    for (let i = 0; i < images.length; i++) {
        const img = images[i];
        const srcData = img.data;
        const dstOffset = currentY * bytesPerScanline;

        mergedData.set(srcData, dstOffset);
        currentY += img.height;
    }

    return mergedData;
}

/**
 * Extracts and consolidates metadata (EXIF APP1 buffer and COM comments) from decoded images.
 *
 * @param images - Array of decoded JPEG images.
 * @returns Extracted unique comments and primary EXIF buffer.
 */
export function extractMetadata(images: DecodedJPEG[]): {
    comments?: string[];
    exifBuffer?: Uint8Array | Buffer;
} {
    let exifBuffer: Uint8Array | Buffer | undefined;
    const commentsList: string[] = [];

    for (const img of images) {
        // Preserve EXIF from the first image slice that contains it
        if (!exifBuffer && img.exifBuffer) {
            exifBuffer = img.exifBuffer;
        }
        if (img.comments) {
            for (const comment of img.comments) {
                if (comment && !commentsList.includes(comment)) {
                    commentsList.push(comment);
                }
            }
        }
    }

    return {
        comments: commentsList.length > 0 ? commentsList : undefined,
        exifBuffer,
    };
}

/**
 * Encodes uncompressed RGBA pixel data to a JPEG binary Uint8Array with optional metadata.
 *
 * @param imageData - Image data object containing RGBA pixels and dimensions.
 * @param options - Encoding options (quality, comments, exifBuffer).
 * @returns Encoded JPEG binary data as a Uint8Array.
 */
export function encodeJPEG(
    imageData: {
        data: Uint8Array;
        width: number;
        height: number;
    },
    options?: JPEGEncodeOptions
): Uint8Array {
    const quality = options?.quality ?? DEFAULT_JPEG_QUALITY;

    const rawImageData: JpegJSEncodeData = {
        data: imageData.data,
        width: imageData.width,
        height: imageData.height,
        comments: options?.comments,
        exifBuffer: options?.exifBuffer,
    };

    const encodeFn = jpeg.encode as unknown as (
        imgData: JpegJSEncodeData,
        qu?: number
    ) => JpegJSEncodeResult;

    const encoded = encodeFn(rawImageData, quality);
    return new Uint8Array(encoded.data);
}

// ============================================================================
// Main Public Function
// ============================================================================

/**
 * Merges multiple JPEG Blob images vertically into a single seamless JPEG Blob.
 *
 * This function decodes all input JPEGs into uncompressed RGBA pixel buffers,
 * validates dimensions, stacks the pixel buffers vertically without DOM Canvas
 * size limitations, preserves EXIF / comments metadata, and re-encodes the result
 * into a single high-quality JPEG.
 *
 * @param blobs - Array of JPEG Blob objects to merge vertically.
 * @param options - Optional configuration for quality and metadata preservation.
 * @returns Promise resolving to the merged JPEG Blob.
 */
export const mergeJPEGsBinary = async (
    blobs: Blob[],
    options?: MergeJPEGsOptions
): Promise<Blob> => {
    console.log(`${LOG_TAG} Starting JPEG merge for ${blobs.length} images...`);

    if (!blobs || blobs.length === 0) {
        throw new Error('No images to merge');
    }

    // 1. Decode all JPEG blobs sequentially to manage memory
    const decodedImages: DecodedJPEG[] = [];
    for (let i = 0; i < blobs.length; i++) {
        const decoded = await decodeJPEGBlob(blobs[i], i);
        decodedImages.push(decoded);
    }

    // 2. Validate dimensions (consistent width across all slices)
    const { width, height: totalHeight } = validateDimensions(decodedImages);
    console.log(`${LOG_TAG} Total dimensions: ${width}x${totalHeight}`);

    // 3. Merge pixel buffers vertically
    const mergedData = mergePixelDataVertically(decodedImages, width, totalHeight);

    // 4. Extract metadata (EXIF and comments) if enabled
    const preserveMetadata = options?.preserveMetadata ?? true;
    const metadata = preserveMetadata ? extractMetadata(decodedImages) : {};

    // 5. Encode the merged pixel data to JPEG
    console.log(`${LOG_TAG} Encoding merged JPEG...`);
    const quality = options?.quality ?? DEFAULT_JPEG_QUALITY;
    const jpegData = encodeJPEG(
        {
            data: mergedData,
            width,
            height: totalHeight,
        },
        {
            quality,
            comments: metadata.comments,
            exifBuffer: metadata.exifBuffer,
        }
    );

    console.log(`${LOG_TAG} Final JPEG size: ${jpegData.length} bytes`);

    // 6. Return as image/jpeg Blob
    return new Blob([jpegData as BlobPart], { type: JPEG_MIME_TYPE });
};
