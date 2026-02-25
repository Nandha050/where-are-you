import { Request, Response } from 'express';
import { userService } from './user.service';

const getMessage = (error: unknown): string =>
    error instanceof Error ? error.message : 'Something went wrong';

export const userAppController = {
    searchBuses: async (req: Request, res: Response): Promise<void> => {
        try {
            if (!req.user?.organizationId) {
                res.status(401).json({ message: 'Unauthorized' });
                return;
            }

            const numberPlate = String(req.query.numberPlate || '').trim();
            if (!numberPlate) {
                res.status(400).json({ message: 'numberPlate query is required' });
                return;
            }

            const buses = await userService.searchBusesForUser(req.user.organizationId, numberPlate);
            res.status(200).json({ buses });
        } catch (error) {
            res.status(400).json({ message: getMessage(error) });
        }
    },

    getLiveBus: async (req: Request, res: Response): Promise<void> => {
        try {
            if (!req.user?.organizationId) {
                res.status(401).json({ message: 'Unauthorized' });
                return;
            }

            const data = await userService.getLiveBusForUser(
                req.user.organizationId,
                String(req.params.busId)
            );

            res.status(200).json(data);
        } catch (error) {
            const message = getMessage(error);
            res.status(message === 'Bus not found' ? 404 : 400).json({ message });
        }
    },

    subscribeBus: async (req: Request, res: Response): Promise<void> => {
        try {
            if (!req.user?.organizationId || !req.user.sub) {
                res.status(401).json({ message: 'Unauthorized' });
                return;
            }

            const subscription = await userService.subscribeToBus(
                req.user.organizationId,
                req.user.sub,
                req.body
            );

            res.status(201).json({ subscription });
        } catch (error) {
            const message = getMessage(error);
            const status =
                message === 'Bus not found' || message === 'Stop not found'
                    ? 404
                    : 400;

            res.status(status).json({ message });
        }
    },

    getMySubscriptions: async (req: Request, res: Response): Promise<void> => {
        try {
            if (!req.user?.organizationId || !req.user.sub) {
                res.status(401).json({ message: 'Unauthorized' });
                return;
            }

            const subscriptions = await userService.getMySubscriptions(
                req.user.organizationId,
                req.user.sub
            );

            res.status(200).json({ subscriptions });
        } catch (error) {
            res.status(400).json({ message: getMessage(error) });
        }
    },

    unsubscribeBus: async (req: Request, res: Response): Promise<void> => {
        try {
            if (!req.user?.organizationId || !req.user.sub) {
                res.status(401).json({ message: 'Unauthorized' });
                return;
            }

            const result = await userService.unsubscribeFromBus(
                req.user.organizationId,
                req.user.sub,
                String(req.params.subscriptionId)
            );

            res.status(200).json(result);
        } catch (error) {
            const message = getMessage(error);
            res.status(message === 'Subscription not found' ? 404 : 400).json({ message });
        }
    },

    updateMyFcmToken: async (req: Request, res: Response): Promise<void> => {
        try {
            if (!req.user?.organizationId || !req.user.sub) {
                res.status(401).json({ message: 'Unauthorized' });
                return;
            }

            const fcmToken = String(req.body?.fcmToken || '').trim();
            if (!fcmToken) {
                res.status(400).json({ message: 'fcmToken is required' });
                return;
            }

            const user = await userService.updateMyFcmToken(
                req.user.organizationId,
                req.user.sub,
                fcmToken
            );

            res.status(200).json({ user });
        } catch (error) {
            const message = getMessage(error);
            res.status(message === 'User not found' ? 404 : 400).json({ message });
        }
    },
};
