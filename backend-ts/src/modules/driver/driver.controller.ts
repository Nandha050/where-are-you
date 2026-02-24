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

            const drivers = await driverService.listDriversByOrganization(req.user.organizationId);

            res.status(200).json({ drivers });
        } catch (error) {
            res.status(400).json({ message: getMessage(error) });
        }
    },
    getMyDetails: async (req: Request, res: Response): Promise<void> => {
        try {
            if (!req.user?.sub) {
                res.status(401).json({ message: 'Unauthorized' });
                return;
            }

            const details = await driverService.getMyDetails(req.user.sub);

            res.status(200).json({ driver: details });
        } catch (error) {
            res.status(400).json({ message: getMessage(error) });
        }
    },

    getMyBus: async (req: Request, res: Response): Promise<void> => {
        try {
            if (!req.user?.sub) {
                res.status(401).json({ message: 'Unauthorized' });
                return;
            }

            const bus = await driverService.getMyBus(req.user.sub);

            res.status(200).json({ bus });
        } catch (error) {
            const statusCode = error instanceof Error && error.message === 'No bus assigned to this driver' ? 404 : 400;
            res.status(statusCode).json({ message: getMessage(error) });
        }
    },
};
