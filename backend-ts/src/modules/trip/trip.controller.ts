import { Request, Response } from 'express';
import { tripService } from './trip.service';

const getMessage = (error: unknown): string =>
    error instanceof Error ? error.message : 'Something went wrong';

export const tripController = {
    getMyActiveTrip: async (req: Request, res: Response): Promise<void> => {
        try {
            if (!req.user?.sub || !req.user.organizationId) {
                res.status(401).json({ message: 'Unauthorized' });
                return;
            }

            const trip = await tripService.getActiveTripByDriverId(
                req.user.sub,
                req.user.organizationId
            );

            res.status(200).json({ trip });
        } catch (error) {
            res.status(400).json({ message: getMessage(error) });
        }
    },

    startTrip: async (req: Request, res: Response): Promise<void> => {
        try {
            if (!req.user?.sub || !req.user.organizationId) {
                res.status(401).json({ message: 'Unauthorized' });
                return;
            }

            const trip = await tripService.startTripForDriver(req.user.sub, req.user.organizationId);
            res.status(201).json({ trip });
        } catch (error) {
            const message = getMessage(error);
            const statusCode =
                message === 'Driver not found' ||
                    message === 'No bus assigned to this driver' ||
                    message === 'Assigned bus not found'
                    ? 404
                    : message === 'An active trip already exists for this driver'
                        ? 409
                        : 400;

            res.status(statusCode).json({ message });
        }
    },

    stopTrip: async (req: Request, res: Response): Promise<void> => {
        try {
            if (!req.user?.sub || !req.user.organizationId) {
                res.status(401).json({ message: 'Unauthorized' });
                return;
            }

            const trip = await tripService.completeActiveTripForDriver(
                req.user.sub,
                req.user.organizationId
            );

            if (!trip) {
                res.status(404).json({ message: 'No active trip found for this driver' });
                return;
            }

            res.status(200).json({ trip });
        } catch (error) {
            res.status(400).json({ message: getMessage(error) });
        }
    },
};
