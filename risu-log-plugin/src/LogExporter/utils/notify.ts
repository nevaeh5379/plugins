import { message } from 'antd';

type MessageType = 'warning' | 'error';

function showNotification(type: MessageType, description: string, duration = 5): void {
    message[type]({
        content: description,
        duration,
        style: {
            maxWidth: '400px',
            wordBreak: 'break-word',
        },
    });
}

export const showWarning = (description: string, duration = 5): void =>
    showNotification('warning', description, duration);

export const showError = (description: string, duration = 5): void =>
    showNotification('error', description, duration);
