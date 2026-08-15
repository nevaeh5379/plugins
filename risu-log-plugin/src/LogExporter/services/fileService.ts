import { message } from '../../components/ui';
import { downloadBlob } from '../utils/captureUtils';

/**
 * Standard MIME types used throughout the file export and clipboard services.
 */
export const MIME_TYPES = {
    HTML: 'text/html;charset=utf-8',
    PLAIN_TEXT: 'text/plain;charset=utf-8',
    JSON: 'application/json;charset=utf-8',
    OCTET_STREAM: 'application/octet-stream',
    ZIP: 'application/zip',
    PNG: 'image/png',
    JPEG: 'image/jpeg',
    WEBP: 'image/webp',
} as const;

export type MimeType = (typeof MIME_TYPES)[keyof typeof MIME_TYPES] | string;

/**
 * Configuration options for copying content to the clipboard.
 */
export interface ClipboardCopyOptions {
    /**
     * Whether to show success / failure toast notifications.
     * @default true
     */
    notify?: boolean;
    /**
     * Optional plain text representation to include in clipboard data alongside HTML.
     * If not specified, the raw content string is used as plain text fallback.
     */
    plainTextFallback?: string;
    /**
     * Custom success message to display on copy.
     */
    successMessage?: string;
    /**
     * Custom error message to display on copy failure.
     */
    errorMessage?: string;
}

/**
 * Default notification messages.
 */
const MESSAGES = {
    COPY_SUCCESS: '클립보드에 HTML 형식으로 복사되었습니다.',
    COPY_SUCCESS_FALLBACK: '클립보드에 HTML 형식으로 복사되었습니다. (대체 방식)',
    COPY_FAILURE: '클립보드 복사에 실패했습니다. RisuAI 상위 문서(iframe)의 클립보드 쓰기 권한 허용이 필요합니다.',
    FILE_SAVE_FAILURE: (filename: string) => `파일 저장에 실패했습니다: ${filename}`,
} as const;

/**
 * Checks if the asynchronous Clipboard API and ClipboardItem constructor are supported in the current environment.
 */
export function isClipboardApiSupported(): boolean {
    return (
        typeof navigator !== 'undefined' &&
        Boolean(navigator.clipboard?.write) &&
        typeof window !== 'undefined' &&
        typeof window.ClipboardItem !== 'undefined'
    );
}

/**
 * Attempts to copy HTML content to the clipboard using the modern Clipboard API (`navigator.clipboard.write`).
 *
 * @param htmlText - The HTML content to write to clipboard.
 * @param plainText - Optional plain text alternative for plaintext paste targets.
 * @returns A Promise resolving to true if successful, false otherwise.
 */
async function copyViaClipboardApi(htmlText: string, plainText?: string): Promise<boolean> {
    try {
        const textPayload = plainText ?? htmlText;
        const htmlBlob = new Blob([htmlText], { type: 'text/html' });
        const textBlob = new Blob([textPayload], { type: 'text/plain' });

        const clipboardItem = new window.ClipboardItem({
            'text/html': htmlBlob,
            'text/plain': textBlob,
        });

        await navigator.clipboard.write([clipboardItem]);
        return true;
    } catch (err) {
        console.warn('[FileService] Async Clipboard API 복사 실패, 대체 방식으로 전환합니다:', err);
        return false;
    }
}

/**
 * Fallback mechanism to copy HTML content via temporary DOM node and `document.execCommand('copy')`.
 * Guarantees DOM cleanup even if selection or execCommand throws an error.
 *
 * @param htmlText - The HTML content to copy.
 * @returns true if copying was reported successful by execCommand, false otherwise.
 */
function copyViaDomFallback(htmlText: string): boolean {
    if (typeof document === 'undefined') {
        return false;
    }

    const container = document.createElement('div');
    container.innerHTML = htmlText;

    // Position container offscreen to prevent layout shift or scrolling
    container.style.position = 'fixed';
    container.style.left = '-9999px';
    container.style.top = '0';
    container.style.opacity = '0';
    container.style.pointerEvents = 'none';
    container.setAttribute('aria-hidden', 'true');

    let successful = false;

    try {
        document.body.appendChild(container);

        const range = document.createRange();
        range.selectNodeContents(container);

        const selection = window.getSelection();
        if (selection) {
            selection.removeAllRanges();
            selection.addRange(range);
            successful = document.execCommand('copy');
            selection.removeAllRanges();
        }
    } catch (err) {
        console.error('[FileService] 대체 클립보드 복사 중 오류:', err);
        successful = false;
    } finally {
        if (container.parentNode) {
            container.parentNode.removeChild(container);
        }
    }

    return successful;
}

/**
 * HTML 형식으로 클립보드에 복사합니다.
 * 최신 Clipboard API를 우선 시도하고, 권한 부족이나 미지원 환경에서는 DOM 기반 대체 방식으로 복사합니다.
 *
 * @param text - 복사할 HTML 또는 텍스트 내용
 * @param options - 복사 알림 및 대체 텍스트 설정 옵션
 * @returns 복사 성공 여부 Promise
 */
export async function copyToClipboard(
    text: string,
    options: ClipboardCopyOptions = {}
): Promise<boolean> {
    const {
        notify = true,
        plainTextFallback,
        successMessage,
        errorMessage,
    } = options;

    // 1. Try Modern Clipboard API
    if (isClipboardApiSupported()) {
        const success = await copyViaClipboardApi(text, plainTextFallback);
        if (success) {
            if (notify) {
                message.success(successMessage || MESSAGES.COPY_SUCCESS);
            }
            return true;
        }
    }

    // 2. Fallback to DOM execCommand
    const fallbackSuccess = copyViaDomFallback(text);
    if (fallbackSuccess) {
        if (notify) {
            message.success(successMessage || MESSAGES.COPY_SUCCESS_FALLBACK);
        }
        return true;
    }

    // 3. Both methods failed
    console.error('[FileService] 클립보드 복사 실패: 사용 가능한 복사 방식이 모두 실패했습니다.');
    if (notify) {
        message.error(errorMessage || MESSAGES.COPY_FAILURE);
    }
    return false;
}

/**
 * 문자열 또는 Blob 데이터를 지정한 파일명으로 다운로드합니다.
 *
 * @param filename - 저장할 파일명 (확장자 포함)
 * @param content - 저장할 파일 내용 (문자열 또는 Blob)
 * @param type - 파일 MIME 타입 (기본값: text/plain;charset=utf-8)
 * @returns 다운로드 완료 Promise
 */
export async function saveAsFile(
    filename: string,
    content: string | Blob,
    type: MimeType = MIME_TYPES.PLAIN_TEXT
): Promise<void> {
    try {
        const blob = content instanceof Blob ? content : new Blob([content], { type });
        await downloadBlob(blob, filename);
    } catch (err) {
        console.error(`[FileService] 파일 저장 실패 (${filename}):`, err);
        message.error(MESSAGES.FILE_SAVE_FAILURE(filename));
    }
}

/**
 * 파일 이름에 포함될 수 없는 특수문자를 안전한 문자로 치환합니다.
 *
 * @param name - 원본 파일 이름
 * @param replacement - 치환할 문자 (기본값: '-')
 * @returns 파일 시스템에서 안전한 파일 이름
 */
export function sanitizeFilename(name: string, replacement = '-'): string {
    return name.replace(/[/\\?%*:|"<>]/g, replacement);
}

/**
 * File 또는 Blob 객체를 텍스트 문자열로 읽어옵니다.
 *
 * @param file - 읽을 File 또는 Blob 객체
 * @param encoding - 인코딩 (기본값: 'utf-8')
 * @returns 텍스트 내용 Promise
 */
export function readTextFile(file: Blob, encoding = 'utf-8'): Promise<string> {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => {
            if (typeof reader.result === 'string') {
                resolve(reader.result);
            } else {
                reject(new Error('[FileService] 파일 내용을 텍스트로 읽을 수 없습니다.'));
            }
        };
        reader.onerror = () => {
            reject(reader.error ?? new Error('[FileService] 파일 읽기 작업 중 오류가 발생했습니다.'));
        };
        reader.readAsText(file, encoding);
    });
}

/**
 * File 또는 Blob 객체를 Data URL (Base64) 문자열로 읽어옵니다.
 *
 * @param file - 읽을 File 또는 Blob 객체
 * @returns Base64 Data URL Promise
 */
export function readFileAsDataUrl(file: Blob): Promise<string> {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => {
            if (typeof reader.result === 'string') {
                resolve(reader.result);
            } else {
                reject(new Error('[FileService] 파일 내용을 Data URL로 읽을 수 없습니다.'));
            }
        };
        reader.onerror = () => {
            reject(reader.error ?? new Error('[FileService] Data URL 변환 중 오류가 발생했습니다.'));
        };
        reader.readAsDataURL(file);
    });
}
