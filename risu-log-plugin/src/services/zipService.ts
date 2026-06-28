// src/services/zipService.ts

import JSZip from 'jszip';
import { convertWebMToAnimatedWebP } from './webmConverter';
import type { ArcaImage } from '../types';
import { fetchToBlobNative } from '../LogExporter/utils/imageUtils';

export async function createZipFromMediaList(
  images: ArcaImage[],
  options: { convertWebM: boolean }
): Promise<Blob> {
  const zip = new JSZip();

  const mediaPromises = images.map(image =>
    fetchToBlobNative(image.url)
      .then(async (blob) => {
        if (options.convertWebM && image.isWebM) {
          try {
            const file = new File([blob], 'video.webm', { type: 'video/webm' });
            const webpBlob = await convertWebMToAnimatedWebP(file, null, null, 80);
            zip.file(image.filename, webpBlob);
            return;
          } catch (e) {
            console.error(`[Arca Zip] WebM 변환 실패, 원본 저장: ${image.url}`, e);
          }
        }
        zip.file(image.filename, blob);
      })
      .catch(e => console.warn(`미디어 처리/압축 실패: ${image.url}`, e))
  );

  await Promise.all(mediaPromises);

  const content = await zip.generateAsync({ type: "blob" });
  return content;
}

