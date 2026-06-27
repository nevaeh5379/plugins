import { message } from 'antd';

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
            fallbackCopyToClipboard(text);
        });
    } else {
        fallbackCopyToClipboard(text);
    }
};

const fallbackCopyToClipboard = (text: string) => {
    try {
        const container = document.createElement('div');
        container.innerHTML = text;
        
        // Avoid scrolling to bottom
        container.style.position = 'fixed';
        container.style.top = '0';
        container.style.left = '0';
        container.style.opacity = '0';
        
        document.body.appendChild(container);
        
        // Select the content
        const range = document.createRange();
        range.selectNodeContents(container);
        
        const selection = window.getSelection();
        if (selection) {
            selection.removeAllRanges();
            selection.addRange(range);
            
            const successful = document.execCommand('copy');
            selection.removeAllRanges();
            document.body.removeChild(container);
            
            if (successful) {
                message.success('클립보드에 HTML 형식으로 복사되었습니다. (대체 방식)');
                return;
            }
        } else {
            document.body.removeChild(container);
        }
        
        console.error('대체 복사 명령어 실패');
        message.error('클립보드 복사에 실패했습니다. RisuAI 상위 문서(iframe)의 클립보드 쓰기 권한 허용이 필요합니다.');
    } catch (err) {
        console.error('대체 클립보드 복사 중 에러:', err);
        message.error('클립보드 복사에 실패했습니다. RisuAI 상위 문서(iframe)의 클립보드 쓰기 권한 허용이 필요합니다.');
    }
};

export const saveAsFile = (filename: string, content: string, type = 'text/plain;charset=utf-8') => {
    const blob = new Blob([content], { type });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
};
