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
            fallbackCopyToClipboard(text);
        });
    } else {
        fallbackCopyToClipboard(text);
    }
};

const fallbackCopyToClipboard = (text: string) => {
    try {
        const isHtml = /<[a-z][\s\S]*>/i.test(text);
        // data: (base64) 또는 blob: 과 같은 로컬/임시 이미지 주소가 포함된 경우에만
        // 브라우저가 이미지 바이너리(파일)를 클립보드에 생성하도록 기존의 DOM 선택 영역 복사 방식을 사용합니다.
        // 아카라이브 CDN 등으로 이미 업로드된 리모트 이미지(http/https)만 있거나 이미지가 없는 경우,
        // 불필요한 CSS 인라인화(스타일 오염)를 막기 위해 깨끗한 copy 이벤트 리스너 방식을 사용합니다.
        const hasLocalImages = isHtml && /<img\s[^>]*src=["']?(data:|blob:)/i.test(text);

        if (hasLocalImages) {
            const container = document.createElement('div');
            container.innerHTML = text;
            
            container.style.position = 'fixed';
            container.style.top = '0';
            container.style.left = '0';
            container.style.opacity = '0';
            
            document.body.appendChild(container);
            
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
                    message.success('클립보드에 HTML 형식으로 복사되었습니다.');
                    return;
                }
            } else {
                document.body.removeChild(container);
            }
        } else {
            // 이미지가 없는 HTML이나 일반 텍스트/마크다운은 copy 이벤트 리스너 방식으로
            // 불필요한 CSS 인라인화나 HTML 태그 유실을 방지합니다.
            const listener = (e: ClipboardEvent) => {
                if (e.clipboardData) {
                    if (isHtml) {
                        e.clipboardData.setData('text/html', text);
                        e.clipboardData.setData('text/plain', text);
                    } else {
                        e.clipboardData.setData('text/plain', text);
                    }
                }
                e.preventDefault();
            };

            document.addEventListener('copy', listener);

            const textArea = document.createElement('textarea');
            textArea.value = 'placeholder';
            textArea.style.position = 'fixed';
            textArea.style.top = '0';
            textArea.style.left = '0';
            textArea.style.opacity = '0';
            document.body.appendChild(textArea);
            
            textArea.focus();
            textArea.select();

            const successful = document.execCommand('copy');
            
            document.body.removeChild(textArea);
            document.removeEventListener('copy', listener);

            if (successful) {
                message.success(isHtml ? '클립보드에 HTML 형식으로 복사되었습니다.' : '클립보드에 복사되었습니다.');
                return;
            }
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
    downloadBlob(blob, filename);
};

