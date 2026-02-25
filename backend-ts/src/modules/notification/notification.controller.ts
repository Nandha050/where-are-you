import { Request, Response } from 'express';
import { notificationService } from './notification.service';

const getMessage = (error: unknown): string =>
	error instanceof Error ? error.message : 'Something went wrong';

export const notificationController = {
	getMyNotifications: async (req: Request, res: Response): Promise<void> => {
		try {
			if (!req.user?.organizationId || !req.user.sub) {
				res.status(401).json({ message: 'Unauthorized' });
				return;
			}

			const notifications = await notificationService.getMyNotifications(
				req.user.organizationId,
				req.user.sub
			);

			res.status(200).json({ notifications });
		} catch (error) {
			res.status(400).json({ message: getMessage(error) });
		}
	},

	markMyNotificationAsRead: async (req: Request, res: Response): Promise<void> => {
		try {
			if (!req.user?.organizationId || !req.user.sub) {
				res.status(401).json({ message: 'Unauthorized' });
				return;
			}

			const notification = await notificationService.markAsRead(
				req.user.organizationId,
				req.user.sub,
				String(req.params.notificationId)
			);

			res.status(200).json({ notification });
		} catch (error) {
			const message = getMessage(error);
			res.status(message === 'Notification not found' ? 404 : 400).json({ message });
		}
	},
};

