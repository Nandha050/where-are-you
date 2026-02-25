import admin from 'firebase-admin';
import { ENV } from './env.config';
import { logger } from '../utils/logger';

let initialized = false;

export const getFirebaseApp = (): admin.app.App | null => {
    if (admin.apps.length > 0) {
        initialized = true;
        return admin.app();
    }

    const hasConfig =
        ENV.FIREBASE_PROJECT_ID && ENV.FIREBASE_CLIENT_EMAIL && ENV.FIREBASE_PRIVATE_KEY;

    if (!hasConfig) {
        if (!initialized) {
            logger.warn('Firebase config missing; push notifications are disabled');
            initialized = true;
        }
        return null;
    }

    try {
        const app = admin.initializeApp({
            credential: admin.credential.cert({
                projectId: ENV.FIREBASE_PROJECT_ID,
                clientEmail: ENV.FIREBASE_CLIENT_EMAIL,
                privateKey: ENV.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n'),
            }),
        });

        initialized = true;
        logger.info('Firebase initialized successfully');
        return app;
    } catch (error) {
        const message = error instanceof Error ? error.message : 'Unknown Firebase error';
        logger.error(`Failed to initialize Firebase: ${message}`);
        initialized = true;
        return null;
    }
};

export const getFirebaseMessaging = (): admin.messaging.Messaging | null => {
    const app = getFirebaseApp();
    if (!app) {
        return null;
    }

    return admin.messaging(app);
};
