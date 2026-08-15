import { getLogHtml } from './htmlGenerator';
import type {
  LogNode,
  ArcaImage,
  LogExportSettings,
  CharInfo,
  GlobalSettings,
} from '../../types';

/**
 * Options for generating ArcaLive content.
 */
export interface GenerateArcaContentOptions {
  /** Whether WebM video/animation files should be converted to WebP. */
  convertWebM: boolean;
}

/**
 * Result of ArcaLive content generation containing the formatted BBCode HTML and media list.
 */
export interface ArcaContentResult {
  html: string;
  images: ArcaImage[];
}

/** Default fallback extension for images without a specified format. */
const DEFAULT_IMAGE_EXTENSION = 'jpg';

/** Target extension for converted WebM media. */
const CONVERTED_WEBM_EXTENSION = 'webp';

/** Hex-encoded string for '.webm' (2e 77 65 62 6d) commonly found in encoded asset paths. */
const WEBM_HEX_SIGNATURE = '2e7765626d';

/** File name prefix for sequential media naming. */
const MEDIA_FILENAME_PREFIX = 'media_';

/** Number of digits to pad sequential media filenames with (e.g. media_001.webp). */
const MEDIA_PAD_LENGTH = 3;

/**
 * Checks if a given media element is an HTML video element.
 */
function isVideoElement(element: Element): element is HTMLVideoElement {
  return element.tagName === 'VIDEO';
}

/**
 * Checks if a given URL refers to a WebM resource (either standard or hex-encoded path).
 */
function isWebmUrl(url: string): boolean {
  const urlLower = url.toLowerCase();
  return urlLower.includes('.webm') || urlLower.includes(WEBM_HEX_SIGNATURE);
}

/**
 * Extracts the media source URL from an image or video element.
 * Returns `null` if the URL is empty or is an inline data URI.
 */
function extractMediaSourceUrl(element: HTMLImageElement | HTMLVideoElement): string | null {
  let rawSrc = '';

  if (isVideoElement(element)) {
    const sourceEl = element.querySelector<HTMLSourceElement>('source');
    rawSrc = sourceEl?.src || element.src || '';
  } else {
    rawSrc = element.src || '';
  }

  const trimmedSrc = rawSrc.trim();
  if (!trimmedSrc || trimmedSrc.startsWith('data:')) {
    return null;
  }

  return trimmedSrc;
}

/**
 * Determines the target file extension for the media asset.
 */
function resolveMediaExtension(
  datasetExtension: string | undefined,
  convertWebM: boolean,
  isWebM: boolean,
): string {
  if (isWebM && convertWebM) {
    return CONVERTED_WEBM_EXTENSION;
  }
  return datasetExtension || DEFAULT_IMAGE_EXTENSION;
}

/**
 * Generates a zero-padded sequential filename for exported media.
 */
function generateMediaFilename(index: number, extension: string): string {
  const paddedIndex = String(index).padStart(MEDIA_PAD_LENGTH, '0');
  return `${MEDIA_FILENAME_PREFIX}${paddedIndex}.${extension}`;
}

/**
 * Updates the DOM element's src attributes to reference the new local filename.
 */
function updateElementSource(
  element: HTMLImageElement | HTMLVideoElement,
  filename: string,
): void {
  if (isVideoElement(element)) {
    const source = element.querySelector<HTMLSourceElement>('source');
    if (source) {
      source.src = filename;
    }
    element.src = filename;
    element.poster = ''; // Remove poster preview for exported video
  } else {
    element.src = filename;
  }
}

/**
 * Formats the final BBCode content string for ArcaLive.
 */
function formatArcaBbcode(
  chatName: string,
  contentHtml: string,
  images: ArcaImage[],
): string {
  const imageListBbcode = images
    .map((img) => `[img]${img.filename}[/img]`)
    .join('\n');

  return `[title]${chatName}[/title]\n[content]${contentHtml}\n\n${imageListBbcode}[/content]`;
}

/**
 * Generates ArcaLive-compatible BBCode and extracts media attachments from chat log nodes.
 *
 * 1. Renders the chat nodes with a clean basic/dark theme.
 * 2. Parses the generated HTML to detect all media elements (images and videos).
 * 3. Rewrites media references to sequential filenames and optionally marks WebM for conversion.
 * 4. Wraps the result into ArcaLive BBCode tags `[title]` and `[content]`.
 *
 * @param nodes - Array of DOM log nodes to export.
 * @param settings - Log export display settings (avatars, headers, bubbles, etc.).
 * @param options - Arca export options (e.g. WebM conversion preference).
 * @param charInfo - Character information (chat name, avatars).
 * @param globalSettings - Global plugin settings.
 * @returns Object containing the formatted ArcaLive BBCode HTML and the list of media descriptors.
 */
export const generateArcaContent = async (
  nodes: LogNode[],
  settings: LogExportSettings,
  options: GenerateArcaContentOptions,
  charInfo: CharInfo,
  globalSettings: GlobalSettings,
): Promise<ArcaContentResult> => {
  // 1. Generate clean HTML using basic theme and dark color scheme
  const html = await getLogHtml({
    nodes,
    charInfo,
    selectedThemeKey: 'basic',
    selectedColorKey: 'dark',
    showAvatar: settings.showAvatar,
    showHeader: settings.showHeader,
    showFooter: settings.showFooter,
    showBubble: settings.showBubble,
    embedImagesAsBlob: false, // Keep source URLs intact for processing
    globalSettings,
  });

  const container = document.createElement('div');
  container.innerHTML = html;

  const images: ArcaImage[] = [];
  const processedUrls = new Set<string>();
  let mediaCounter = 0;

  const mediaElements = Array.from(
    container.querySelectorAll<HTMLImageElement | HTMLVideoElement>('img, video'),
  );

  for (const element of mediaElements) {
    const src = extractMediaSourceUrl(element);

    if (!src || processedUrls.has(src)) {
      continue;
    }
    processedUrls.add(src);

    mediaCounter++;

    const isWebM = isWebmUrl(src);
    const extension = resolveMediaExtension(
      element.dataset.extension,
      options.convertWebM,
      isWebM,
    );
    const filename = generateMediaFilename(mediaCounter, extension);

    images.push({ url: src, filename, isWebM });

    // Replace the HTML element's src attribute with the new filename
    updateElementSource(element, filename);
  }

  // 2. Wrap into ArcaLive BBCode format
  const chatName = charInfo.chatName || '';
  const finalHtml = formatArcaBbcode(chatName, container.innerHTML, images);

  return { html: finalHtml, images };
};