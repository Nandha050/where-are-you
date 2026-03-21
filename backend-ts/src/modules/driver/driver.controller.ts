import { Request, Response } from 'express';
import { driverService } from './driver.service';

const getMessage = (error: unknown): string => {
    if (error instanceof Error) {
        return error.message;
    }
    return 'Something went wrong';
};

export const driverController = {
    listDrivers: async (req: Request, res: Response): Promise<void> => {
        try {
            if (!req.user?.organizationId) {
                res.status(401).json({ message: 'Unauthorized' });
                return;
            }

            const query = typeof req.query.q === 'string' ? req.query.q : undefined;
            const drivers = await driverService.listDriversByOrganization(req.user.organizationId, query);

            res.status(200).json({ drivers });
        } catch (error) {
            res.status(400).json({ message: getMessage(error) });
        }
    },

    updateDriver: async (req: Request, res: Response): Promise<void> => {
        try {
            if (!req.user?.organizationId) {
                res.status(401).json({ message: 'Unauthorized' });
                return;
            }

            const driver = await driverService.updateDriverByAdmin(
                req.user.organizationId,
                String(req.params.id),
                req.body
            );

            res.status(200).json({ driver });
        } catch (error) {
            const message = getMessage(error);
            const statusCode = message === 'Driver not found' ? 404 : 400;
            res.status(statusCode).json({ message });
        }
    },

    deleteDriver: async (req: Request, res: Response): Promise<void> => {
        try {
            if (!req.user?.organizationId) {
                res.status(401).json({ message: 'Unauthorized' });
                return;
            }

            const result = await driverService.deleteDriverByAdmin(
                req.user.organizationId,
                String(req.params.id)
            );

            res.status(200).json(result);
        } catch (error) {
            const message = getMessage(error);
            res.status(message === 'Driver not found' ? 404 : 400).json({ message });
        }
    },
    getMyDetails: async (req: Request, res: Response): Promise<void> => {
        try {
            if (!req.user?.sub || !req.user.organizationId) {
                res.status(401).json({ message: 'Unauthorized' });
                return;
            }

            const details = await driverService.getMyDetails(req.user.sub, req.user.organizationId);

            // Keep both contracts during migration: top-level payload and nested `driver` payload.
            res.status(200).json({ ...details, driver: details });
        } catch (error) {
            res.status(400).json({ message: getMessage(error) });
        }
    },

    getMyBus: async (req: Request, res: Response): Promise<void> => {
        try {
            if (!req.user?.sub || !req.user.organizationId) {
                res.status(401).json({ message: 'Unauthorized' });
                return;
            }

            const bus = await driverService.getMyBus(req.user.sub, req.user.organizationId);

            res.status(200).json({ bus });
        } catch (error) {
            const message = getMessage(error);
            const statusCode =
                message === 'Driver not found' ||
                    message.startsWith('No bus assigned to this driver')
                    ? 404
                    : 400;
            res.status(statusCode).json({ message: getMessage(error) });
        }
    },

    getMyRoute: async (req: Request, res: Response): Promise<void> => {
        try {
            if (!req.user?.sub || !req.user.organizationId) {
                res.status(401).json({ message: 'Unauthorized' });
                return;
            }

            const data = await driverService.getMyRoute(req.user.sub, req.user.organizationId);

            res.status(200).json(data);
        } catch (error) {
            const message = getMessage(error);
            const statusCode =
                message === 'No bus assigned to this driver' ||
                    message.startsWith('No bus assigned to this driver') ||
                    message === 'No route assigned to this bus' ||
                    message === 'Route not found'
                    ? 404
                    : 400;

            res.status(statusCode).json({ message });
        }
    },

    startTracking: async (req: Request, res: Response): Promise<void> => {
        try {
            if (!req.user?.sub || !req.user.organizationId) {
                res.status(401).json({ message: 'Unauthorized' });
                return;
            }

            const result = await driverService.startMyTracking(req.user.sub, req.user.organizationId);
            res.status(200).json(result);
        } catch (error) {
            const message = getMessage(error);
            const statusCode =
                message === 'Driver not found' ||
                    message.startsWith('No bus assigned to this driver')
                    ? 404
                    : 400;

            res.status(statusCode).json({ message });
        }
    },

    stopTracking: async (req: Request, res: Response): Promise<void> => {
        try {
            if (!req.user?.sub || !req.user.organizationId) {
                res.status(401).json({ message: 'Unauthorized' });
                return;
            }

            const result = await driverService.stopMyTracking(req.user.sub, req.user.organizationId);
            res.status(200).json(result);
        } catch (error) {
            const message = getMessage(error);
            const statusCode =
                message === 'Driver not found' ||
                    message.startsWith('No bus assigned to this driver')
                    ? 404
                    : 400;

            res.status(statusCode).json({ message });
        }
    },
};
