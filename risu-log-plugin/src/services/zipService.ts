// src/services/zipService.ts

import JSZip from 'jszip';
import { convertWebMToAnimatedWebP } from './webmConverter';
import type { ArcaImage } from '../types';

const getBlobFromUrl = (url: string): Promise<Blob> => {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "Anonymous";
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = img.naturalWidth;
      canvas.height = img.naturalHeight;
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        return reject(new Error('Could not get canvas context'));
      }
      ctx.drawImage(img, 0, 0);
      canvas.toBlob((blob) => {
        if (blob) {
          resolve(blob);
        } else {
          reject(new Error('Canvas toBlob failed for ' + url));
        }
      });
    };
    img.onerror = () => {
      // If the canvas method fails (e.g., tainted by CORS), fall back to a direct fetch.
      // This will work for same-origin or CORS-enabled images.
      fetch(url)
        .then(res => {
          if (!res.ok) throw new Error(`Fallback fetch failed: ${res.statusText} for ${url}`);
          return res.blob();
        })
        .then(resolve)
        .catch(reject);
    };
    img.src = url;
  });
};


export async function createZipFromMediaList(
  images: ArcaImage[],
  options: { convertWebM: boolean }
): Promise<Blob> {
  const zip = new JSZip();

  const mediaPromises = images.map(image =>
    (image.isWebM ? fetch(image.url).then(res => res.blob()) : getBlobFromUrl(image.url))
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
