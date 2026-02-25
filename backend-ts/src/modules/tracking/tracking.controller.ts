import { Request, Response } from 'express';
import { trackingService } from './tracking.service';

const getMessage = (error: unknown): string =>
	error instanceof Error ? error.message : 'Something went wrong';

export const trackingController = {
	updateMyLocation: async (req: Request, res: Response): Promise<void> => {
		try {
			if (!req.user?.sub || !req.user.organizationId) {
				res.status(401).json({ message: 'Unauthorized' });
				return;
			}

			const { latitude, longitude } = req.body as {
				latitude?: number;
				longitude?: number;
			};

			if (typeof latitude !== 'number' || typeof longitude !== 'number') {
				res.status(400).json({ message: 'latitude and longitude are required as numbers' });
				return;
			}

			const location = await trackingService.updateMyBusLocation(
				req.user.sub,
				req.user.organizationId,
				latitude,
				longitude
			);

			res.status(200).json({ location });
		} catch (error) {
			const message = getMessage(error);
			const statusCode =
				message === 'Driver not found' ||
				message === 'No bus assigned to this driver' ||
				message === 'Assigned bus not found'
					? 404
					: 400;

			res.status(statusCode).json({ message });
		}
	},
};
