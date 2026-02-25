import { getFirebaseMessaging } from '../config/firebase.config';
import { logger } from './logger';

interface SendPushParams {
    fcmToken: string;
    title: string;
    body: string;
    data?: Record<string, string>;
}

export const sendPushNotification = async ({
    fcmToken,
    title,
    body,
    data = {},
}: SendPushParams): Promise<void> => {
    const messaging = getFirebaseMessaging();
    if (!messaging) {
        return;
    }

    try {
        await messaging.send({
            token: fcmToken,
            notification: {
                title,
                body,
            },
            data,
        });
    } catch (error) {
        const message = error instanceof Error ? error.message : 'Unknown push error';
        logger.warn(`Push notification failed: ${message}`);
    }
};
