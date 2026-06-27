import { message } from 'antd';

/**
 * 경고 토스트 알림을 표시합니다.
 * 내보내기 중 이미지 변환 실패 등, 사용자에게 알리되 흐름을 막지 않는 경우에 사용합니다.
 */
export const showWarning = (description: string, duration = 5): void => {
    message.warning({
        content: description,
        duration,
        style: {
            maxWidth: '400px',
            wordBreak: 'break-word',
        },
    });
};

/**
 * 에러 토스트 알림을 표시합니다.
 * 처리에 실패한 경우 사용자에게 알립니다.
 */
export const showError = (description: string, duration = 5): void => {
    message.error({
        content: description,
        duration,
        style: {
            maxWidth: '400px',
            wordBreak: 'break-word',
        },
    });
};
