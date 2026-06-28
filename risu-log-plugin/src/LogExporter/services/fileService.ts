import { message } from 'antd';
import { downloadBlob } from '../utils/captureUtils';

/**
 * HTML 형식으로 클립보드에 복사합니다.
 * 성공 시 토스트 알림을 표시합니다.
 */
export const copyToClipboard = (text: string) => {
    if (navigator.clipboard && navigator.clipboard.write && typeof window.ClipboardItem !== 'undefined') {
        const htmlBlob = new Blob([text], { type: 'text/html' });
        const textBlob = new Blob([text], { type: 'text/plain' });
        
        const clipboardItem = new window.ClipboardItem({
            'text/html': htmlBlob,
            'text/plain': textBlob
        });
        
        navigator.clipboard.write([clipboardItem]).then(() => {
            message.success('클립보드에 HTML 형식으로 복사되었습니다.');
        }).catch(err => {
            console.error('클립보드 복사 실패:', err);
            message.success('클립보드에 저장 실패했습니다.');
        });
    } else {
        console.error('클립보드 복사 실패:');
        message.success('클립보드에 저장 실패했습니다.');
    }
};

export const saveAsFile = (filename: string, content: string, type = 'text/plain;charset=utf-8') => {
    const blob = new Blob([content], { type });
    downloadBlob(blob, filename);
};

