// src/services/zipService.ts

import JSZip from 'jszip';
import { convertWebMToAnimatedWebP } from './webmConverter';
import type { ArcaImage } from '../types';
import { fetchToBlobNative } from '../LogExporter/utils/imageUtils';

/**
 * Options for ZIP archive creation from media items.
 */
export interface CreateZipOptions {
  /**
   * Whether to convert WebM video files to animated WebP format before archiving.
   */
  convertWebM: boolean;
}

/** Default WebP conversion quality for WebM files (1-100) */
const WEBM_CONVERSION_QUALITY = 80;

/** Default temporary filename used when constructing File objects from WebM blobs */
const WEBM_TEMP_FILENAME = 'video.webm';

/** MIME type for WebM video content */
const WEBM_MIME_TYPE = 'video/webm';

/**
 * Converts a WebM blob to an animated WebP blob.
 * Returns the converted Blob, or throws an error if conversion fails.
 */
async function convertWebMToWebP(blob: Blob): Promise<Blob> {
  const file = new File([blob], WEBM_TEMP_FILENAME, {
    type: blob.type || WEBM_MIME_TYPE,
  });
  return convertWebMToAnimatedWebP(file, null, null, WEBM_CONVERSION_QUALITY);
}

/**
 * Fetches and prepares a single media item for ZIP inclusion,
 * performing WebM to WebP conversion if requested and applicable.
 *
 * @returns The resolved media payload, or `null` if media fetch/processing failed completely.
 */
async function prepareMediaItem(
  image: ArcaImage,
  options: CreateZipOptions
): Promise<{ filename: string; blob: Blob } | null> {
  try {
    const rawBlob = await fetchToBlobNative(image.url);

    // Convert WebM to WebP if enabled
    if (options.convertWebM && image.isWebM) {
      try {
        const webpBlob = await convertWebMToWebP(rawBlob);
        return { filename: image.filename, blob: webpBlob };
      } catch (conversionError) {
        console.error(
          `[ZipService] WebM conversion failed, saving original blob: ${image.url}`,
          conversionError
        );
      }
    }

    return { filename: image.filename, blob: rawBlob };
  } catch (error) {
    console.warn(`[ZipService] Failed to process media: ${image.url}`, error);
    return null;
  }
}

/**
 * Creates a ZIP archive Blob containing the provided media list.
 *
 * @param images - Array of media items to include in the ZIP.
 * @param options - Archiving options such as WebM conversion.
 * @returns A Promise resolving to the generated ZIP Blob.
 */
export async function createZipFromMediaList(
  images: ArcaImage[],
  options: CreateZipOptions
): Promise<Blob> {
  const zip = new JSZip();

  // Process all media items concurrently
  const processPromises = images.map(async (image) => {
    const mediaItem = await prepareMediaItem(image, options);
    if (mediaItem) {
      zip.file(mediaItem.filename, mediaItem.blob);
    }
  });

  await Promise.all(processPromises);

  return zip.generateAsync({ type: 'blob' });
}
