import type { CSSProperties, ReactNode } from 'react';
import { message } from '../../components/ui';

/**
 * Supported notification message types.
 */
export type NotificationType = 'info' | 'success' | 'warning' | 'error';

/**
 * Default display duration for notifications in seconds.
 */
export const DEFAULT_NOTIFICATION_DURATION = 5;

/**
 * Default CSS styling applied to notification toasts.
 * Ensures long text breaks properly and notifications remain compact.
 */
export const DEFAULT_NOTIFICATION_STYLE: CSSProperties = {
    maxWidth: '400px',
    wordBreak: 'break-word',
};

/**
 * Displays a toast notification with consistent styling and duration.
 *
 * @param type - The severity/type of the notification ('info' | 'success' | 'warning' | 'error').
 * @param description - The message content or React node to display.
 * @param duration - Display duration in seconds (defaults to 5 seconds).
 */
export function showNotification(
    type: NotificationType,
    description: ReactNode,
    duration = DEFAULT_NOTIFICATION_DURATION
): void {
    const handler = message[type];
    if (typeof handler === 'function') {
        handler({
            content: description,
            duration,
            style: DEFAULT_NOTIFICATION_STYLE,
        });
    }
}

/**
 * Displays a warning toast notification.
 *
 * @param description - The warning message content.
 * @param duration - Display duration in seconds (defaults to 5 seconds).
 *
 * @example
 * ```ts
 * showWarning('Failed to embed image');
 * ```
 */
export const showWarning = (
    description: ReactNode,
    duration = DEFAULT_NOTIFICATION_DURATION
): void => showNotification('warning', description, duration);

/**
 * Displays an error toast notification.
 *
 * @param description - The error message content.
 * @param duration - Display duration in seconds (defaults to 5 seconds).
 *
 * @example
 * ```ts
 * showError('An unexpected error occurred while exporting logs.');
 * ```
 */
export const showError = (
    description: ReactNode,
    duration = DEFAULT_NOTIFICATION_DURATION
): void => showNotification('error', description, duration);

/**
 * Displays a success toast notification.
 *
 * @param description - The success message content.
 * @param duration - Display duration in seconds (defaults to 5 seconds).
 *
 * @example
 * ```ts
 * showSuccess('Log export completed successfully.');
 * ```
 */
export const showSuccess = (
    description: ReactNode,
    duration = DEFAULT_NOTIFICATION_DURATION
): void => showNotification('success', description, duration);

/**
 * Displays an informational toast notification.
 *
 * @param description - The info message content.
 * @param duration - Display duration in seconds (defaults to 5 seconds).
 *
 * @example
 * ```ts
 * showInfo('Processing message attachments...');
 * ```
 */
export const showInfo = (
    description: ReactNode,
    duration = DEFAULT_NOTIFICATION_DURATION
): void => showNotification('info', description, duration);

/**
 * Unified notification API namespace providing convenient access to all toast methods.
 */
export const notify = {
    show: showNotification,
    warning: showWarning,
    error: showError,
    success: showSuccess,
    info: showInfo,
} as const;
