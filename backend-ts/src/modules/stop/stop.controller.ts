import { Request, Response } from 'express';
import { stopService } from './stop.service';

const getMessage = (error: unknown): string =>
    error instanceof Error ? error.message : 'Something went wrong';

export const stopController = {
    createStop: async (req: Request, res: Response): Promise<void> => {
        try {
            if (!req.user?.organizationId) {
                res.status(401).json({ message: 'Unauthorized' });
                return;
            }
            const { name, latitude, longitude, sequenceOrder, radiusMeters } = req.body as {
                name: string;
                latitude: number;
                longitude: number;
                sequenceOrder: number;
                radiusMeters?: number;
            };
            const stop = await stopService.createStop(
                req.user.organizationId,
                String(req.params.routeId),
                { name, latitude, longitude, sequenceOrder, radiusMeters }
            );
            res.status(201).json({ stop });
        } catch (error) {
            res.status(400).json({ message: getMessage(error) });
        }
    },

    getStopsByRoute: async (req: Request, res: Response): Promise<void> => {
        try {
            if (!req.user?.organizationId) {
                res.status(401).json({ message: 'Unauthorized' });
                return;
            }
            const stops = await stopService.getStopsByRoute(
                req.user.organizationId,
                String(req.params.routeId)
            );
            res.status(200).json({ stops });
        } catch (error) {
            res.status(404).json({ message: getMessage(error) });
        }
    },

    updateStop: async (req: Request, res: Response): Promise<void> => {
        try {
            if (!req.user?.organizationId) {
                res.status(401).json({ message: 'Unauthorized' });
                return;
            }
            const stop = await stopService.updateStop(
                req.user.organizationId,
                String(req.params.id),
                req.body
            );
            res.status(200).json({ stop });
        } catch (error) {
            res.status(400).json({ message: getMessage(error) });
        }
    },

    deleteStop: async (req: Request, res: Response): Promise<void> => {
        try {
            if (!req.user?.organizationId) {
                res.status(401).json({ message: 'Unauthorized' });
                return;
            }
            const result = await stopService.deleteStop(
                req.user.organizationId,
                String(req.params.id)
            );
            res.status(200).json(result);
        } catch (error) {
            res.status(404).json({ message: getMessage(error) });
        }
    },
};
