import { Request, Response } from 'express';
import { routeService } from './route.service';

const getMessage = (error: unknown): string =>
    error instanceof Error ? error.message : 'Something went wrong';

export const routeController = {
    createRoute: async (req: Request, res: Response): Promise<void> => {
        try {
            const { name, startLat, startLng, endLat, endLng } = req.body as {
                name: string;
                startLat: number;
                startLng: number;
                endLat: number;
                endLng: number;
            };

            if (!req.user?.organizationId) {
                res.status(401).json({ message: 'Unauthorized' });
                return;
            }

            const route = await routeService.createRoute(req.user.organizationId, {
                name,
                startLat,
                startLng,
                endLat,
                endLng,
            });

            res.status(201).json({ route });
        } catch (error) {
            res.status(400).json({ message: getMessage(error) });
        }
    },

    getRoutes: async (req: Request, res: Response): Promise<void> => {
        try {
            if (!req.user?.organizationId) {
                res.status(401).json({ message: 'Unauthorized' });
                return;
            }

            const routes = await routeService.getRoutes(req.user.organizationId);
            res.status(200).json({ routes });
        } catch (error) {
            res.status(500).json({ message: getMessage(error) });
        }
    },

    getRouteById: async (req: Request, res: Response): Promise<void> => {
        try {
            if (!req.user?.organizationId) {
                res.status(401).json({ message: 'Unauthorized' });
                return;
            }

            const route = await routeService.getRouteById(req.user.organizationId, String(req.params.id));
            res.status(200).json({ route });
        } catch (error) {
            res.status(404).json({ message: getMessage(error) });
        }
    },

    deleteRoute: async (req: Request, res: Response): Promise<void> => {
        try {
            if (!req.user?.organizationId) {
                res.status(401).json({ message: 'Unauthorized' });
                return;
            }

            const result = await routeService.deleteRoute(req.user.organizationId, String(req.params.id));
            res.status(200).json(result);
        } catch (error) {
            res.status(404).json({ message: getMessage(error) });
        }
    },
};
