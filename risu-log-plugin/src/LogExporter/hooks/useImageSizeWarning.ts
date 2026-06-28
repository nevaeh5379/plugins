import { useEffect, useState } from 'react';
import type { EstimatedImageSize } from './types';
import type { LogExporterSettings } from './types';

const MAX_DIMENSION = 16384;

export function useImageSizeWarning(
  estimatedImageSize: EstimatedImageSize | null,
  settings: LogExporterSettings,
): string {
  const [warning, setWarning] = useState('');

  useEffect(() => {
    if (!estimatedImageSize) {
      setWarning('');
      return;
    }

    const resolution = settings.imageResolution === 'auto' ? 1 : (Number(settings.imageResolution) || 1);
    const finalWidth = estimatedImageSize.width * resolution;
    const finalHeight = estimatedImageSize.height * resolution;

    const warnings: string[] = [];

    if (finalWidth > MAX_DIMENSION || finalHeight > MAX_DIMENSION) {
      let message = `예상 이미지 크기(${Math.round(finalWidth)}x${Math.round(finalHeight)}px)가 브라우저 한계를 초과할 수 있습니다.`;
      if (settings.splitImage === 'none') {
        message += " '긴 이미지 분할' 옵션 사용을 권장합니다.";
      }
      if (settings.imageResolution === 'auto') {
        message += " '자동' 해상도는 현재 1x로 계산됩니다.";
      }
      warnings.push(message);
    }

    if (settings.splitImage !== 'none' && estimatedImageSize.maxMessageHeight > (settings.maxImageHeight || 10000)) {
      if (settings.splitImage === 'chunk') {
        warnings.push(`분할 최대 높이(${settings.maxImageHeight || 10000}px)보다 긴 로그가 있습니다. 여러 섹션으로 분할 캡처 후 하나의 이미지 파일로 병합됩니다.`);
      } else {
        warnings.push(`분할 최대 높이(${settings.maxImageHeight || 10000}px)보다 긴 메시지가 있습니다. 해당 메시지는 여러 섹션으로 분할하여 개별 파일로 저장됩니다.`);
      }
    }

    setWarning(warnings.join(' '));
  }, [estimatedImageSize, settings]);

  return warning;
}
