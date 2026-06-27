import { useState, useEffect } from 'react';
import { imageUrlToBlob } from '../utils/imageUtils';
import { showWarning } from '../utils/notify';

/**
 * 이미지 URL을 blob(data URL)로 변환합니다.
 * 변환 실패 시 원본 URL을 유지합니다.
 */
export function useConvertedImage(
    url: string | undefined,
    embedAsBlob: boolean
): string | undefined {
    const [convertedUrl, setConvertedUrl] = useState(url);

    useEffect(() => {
        setConvertedUrl(url);
    }, [url]);

    useEffect(() => {
        if (!embedAsBlob || !url) return;

        let cancelled = false;
        const convert = async () => {
            try {
                const blobUrl = await imageUrlToBlob(url);
                if (!cancelled) setConvertedUrl(blobUrl);
            } catch (e) {
                console.error('[log plugin] Failed to convert image to blob:', url, e);
            }
        };
        convert();
        return () => { cancelled = true; };
    }, [url, embedAsBlob]);

    return convertedUrl;
}

/**
 * 아바타 URL을 blob(data URL)로 변환합니다.
 */
export function useAvatarBlob(
    avatarUrl: string | undefined,
    embedAsBlob: boolean
): string | undefined {
    return useConvertedImage(avatarUrl, embedAsBlob);
}

/**
 * 여러 이미지 URL을 동시에 blob으로 변환합니다.
 */
export function useMultiImageBlob(
    urls: string[],
    embedAsBlob: boolean
): (string | undefined)[] {
    const [convertedUrls, setConvertedUrls] = useState(() => urls.map(u => u));

    useEffect(() => {
        setConvertedUrls(urls.map(u => u));
    }, [urls]);

    useEffect(() => {
        if (!embedAsBlob) return;

        let cancelled = false;
        const convert = async () => {
            const results = await Promise.all(
                urls.map(async (url) => {
                    if (!url) return url;
                    try {
                        return await imageUrlToBlob(url);
                    } catch (e) {
                        console.error('[log plugin] Failed to convert image to blob:', url, e);
                        showWarning(`이미지 변환 실패: ${url.substring(0, 80)}${url.length > 80 ? '...' : ''}`);
                        return url;
                    }
                })
            );
            if (!cancelled) setConvertedUrls(results);
        };
        convert();
        return () => { cancelled = true; };
    }, [urls, embedAsBlob]);

    return convertedUrls;
}

/**
 * 쉼표로 구분된 태그 문자열을 배열로 파싱합니다.
 */
export function useParsedTags(tagsString?: string): string[] {
    return tagsString ? tagsString.split(',').map(t => t.trim()).filter(Boolean) : [];
}
