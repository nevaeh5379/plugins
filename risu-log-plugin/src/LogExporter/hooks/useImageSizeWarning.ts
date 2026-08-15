import { useMemo } from 'react';
import type { EstimatedImageSize, LogExporterSettings } from './types';

/**
 * Browser canvas and WebGL maximum safe texture dimension in pixels (16k / 16,384px).
 * Images exceeding this dimension in width or height may fail to render or crash the canvas context.
 */
export const MAX_CANVAS_DIMENSION = 16384;

/**
 * Default fallback threshold (in pixels) for long message splitting when not configured.
 */
export const DEFAULT_MAX_SPLIT_HEIGHT = 10000;

/**
 * Exporter settings subset required to evaluate image size constraints.
 */
export type ImageSizeWarningSettings = Pick<
  LogExporterSettings,
  'imageResolution' | 'splitImage' | 'maxImageHeight'
>;

/**
 * Scaled image dimension metrics used for warning calculations.
 */
export interface ComputedImageDimensions {
  readonly width: number;
  readonly height: number;
  readonly maxMessageHeight: number;
  readonly resolution: number;
}

/**
 * Resolves the numeric scale factor from the exporter resolution setting.
 * When set to 'auto', it defaults to 1x for size estimation purposes.
 */
export function getEffectiveResolution(
  resolution: LogExporterSettings['imageResolution'],
): number {
  if (resolution === 'auto') {
    return 1;
  }
  const numeric = Number(resolution);
  return Number.isFinite(numeric) && numeric > 0 ? numeric : 1;
}

/**
 * Calculates scaled image dimensions based on estimated size and effective resolution factor.
 */
export function calculateImageDimensions(
  estimatedSize: EstimatedImageSize,
  resolution: number,
): ComputedImageDimensions {
  return {
    width: estimatedSize.width * resolution,
    height: estimatedSize.height * resolution,
    maxMessageHeight: estimatedSize.maxMessageHeight,
    resolution,
  };
}

/**
 * Evaluates whether scaled dimensions exceed browser canvas limits and constructs guidance.
 */
function buildDimensionExceededWarning(
  dimensions: ComputedImageDimensions,
  settings: ImageSizeWarningSettings,
): string | null {
  const { width, height } = dimensions;

  if (width <= MAX_CANVAS_DIMENSION && height <= MAX_CANVAS_DIMENSION) {
    return null;
  }

  const roundedWidth = Math.round(width);
  const roundedHeight = Math.round(height);
  let message = `예상 이미지 크기(${roundedWidth}x${roundedHeight}px)가 브라우저 한계를 초과할 수 있습니다.`;

  if (settings.splitImage === 'none') {
    message += " '긴 이미지 분할' 옵션 사용을 권장합니다.";
  }

  if (settings.imageResolution === 'auto') {
    message += " '자동' 해상도는 현재 1x로 계산됩니다.";
  }

  return message;
}

/**
 * Evaluates whether any individual message height exceeds the split threshold.
 */
function buildMessageSplitWarning(
  dimensions: ComputedImageDimensions,
  settings: ImageSizeWarningSettings,
): string | null {
  if (settings.splitImage === 'none') {
    return null;
  }

  const maxHeight = settings.maxImageHeight || DEFAULT_MAX_SPLIT_HEIGHT;

  if (dimensions.maxMessageHeight <= maxHeight) {
    return null;
  }

  if (settings.splitImage === 'chunk') {
    return `분할 최대 높이(${maxHeight}px)보다 긴 로그가 있습니다. 여러 섹션으로 분할 캡처 후 하나의 이미지 파일로 병합됩니다.`;
  }

  return `분할 최대 높이(${maxHeight}px)보다 긴 메시지가 있습니다. 해당 메시지는 여러 섹션으로 분할하여 개별 파일로 저장됩니다.`;
}

/**
 * Pure evaluation function that calculates warning messages for image export size,
 * browser canvas limits, and splitting configuration.
 */
export function getImageSizeWarning(
  estimatedImageSize: EstimatedImageSize | null,
  settings: ImageSizeWarningSettings,
): string {
  if (!estimatedImageSize) {
    return '';
  }

  const resolution = getEffectiveResolution(settings.imageResolution);
  const dimensions = calculateImageDimensions(estimatedImageSize, resolution);

  const warnings: string[] = [];

  const dimensionWarning = buildDimensionExceededWarning(dimensions, settings);
  if (dimensionWarning) {
    warnings.push(dimensionWarning);
  }

  const splitWarning = buildMessageSplitWarning(dimensions, settings);
  if (splitWarning) {
    warnings.push(splitWarning);
  }

  return warnings.join(' ');
}

/**
 * Custom React hook that evaluates estimated export dimensions against browser canvas limits
 * and returns user-facing warning messages.
 *
 * @param estimatedImageSize - Estimated dimensions of the rendered log export, or null if unmeasured.
 * @param settings - Log exporter settings determining resolution and image splitting behavior.
 * @returns Combined warning string, or an empty string if dimensions are within safe thresholds.
 */
export function useImageSizeWarning(
  estimatedImageSize: EstimatedImageSize | null,
  settings: LogExporterSettings,
): string {
  const { imageResolution, splitImage, maxImageHeight } = settings;

  return useMemo(() => {
    return getImageSizeWarning(estimatedImageSize, {
      imageResolution,
      splitImage,
      maxImageHeight,
    });
  }, [estimatedImageSize, imageResolution, splitImage, maxImageHeight]);
}
