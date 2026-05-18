export const NOTIFICATION_QUEUE = 'notification';
/** @alias NOTIFICATION_QUEUE */
export const NOTIFICATION_QUEUE_NAME = NOTIFICATION_QUEUE;

export const NOTIFICATION_JOBS = {
  SEND_WELCOME_EMAIL: 'send-welcome-email',
  SEND_ACCOUNT_UPDATE_EMAIL: 'send-account-update-email',
  SEND_PASSWORD_RESET_EMAIL: 'send-password-reset-email',
  SEND_EMAIL_VERIFICATION: 'send-email-verification',
} as const;

export type NotificationJobName = (typeof NOTIFICATION_JOBS)[keyof typeof NOTIFICATION_JOBS];
