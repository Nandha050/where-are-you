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

			const body = req.body as {
				latitude?: number;
				longitude?: number;
				lat?: number;
				lng?: number;
				speed?: number;
				heading?: number;
				timestamp?: string;
				locations?: Array<{
					latitude?: number;
					longitude?: number;
					lat?: number;
					lng?: number;
					speed?: number;
					heading?: number;
					timestamp?: string;
				}>;
			};

			const items = Array.isArray(body.locations)
				? body.locations
				: [
					{
						latitude: body.latitude,
						longitude: body.longitude,
						lat: body.lat,
						lng: body.lng,
						speed: body.speed,
						heading: body.heading,
						timestamp: body.timestamp,
					},
				];

			if (items.length === 0) {
				res.status(400).json({ message: 'locations must contain at least one point' });
				return;
			}

			let location: Awaited<ReturnType<typeof trackingService.updateMyBusLocation>> | null = null;

			for (const item of items) {
				const latitude = typeof item.latitude === 'number' ? item.latitude : item.lat;
				const longitude = typeof item.longitude === 'number' ? item.longitude : item.lng;

				if (typeof latitude !== 'number' || typeof longitude !== 'number') {
					res.status(400).json({ message: 'latitude and longitude are required as numbers' });
					return;
				}

				if (typeof item.speed !== 'undefined' && typeof item.speed !== 'number') {
					res.status(400).json({ message: 'speed must be a number when provided' });
					return;
				}

				if (typeof item.heading !== 'undefined' && typeof item.heading !== 'number') {
					res.status(400).json({ message: 'heading must be a number when provided' });
					return;
				}

				let recordedAt: Date | undefined;
				if (typeof item.timestamp === 'string' && item.timestamp.trim().length > 0) {
					recordedAt = new Date(item.timestamp);
					if (Number.isNaN(recordedAt.getTime())) {
						res.status(400).json({ message: 'timestamp must be a valid ISO date string' });
						return;
					}
				}

				location = await trackingService.updateMyBusLocation(
					req.user.sub,
					req.user.organizationId,
					latitude,
					longitude,
					item.speed,
					recordedAt,
					item.heading
				);
			}

			if (!location) {
				res.status(400).json({ message: 'No location points were processed' });
				return;
			}

			res.status(200).json({ location });
		} catch (error) {
			const message = getMessage(error);
			const statusCode =
				message === 'Driver not found' ||
					message === 'No bus assigned to this driver' ||
					message === 'Assigned bus not found' ||
					message === 'No active trip found for this driver'
					? 404
					: 400;

			res.status(statusCode).json({ message });
		}
	},
};
