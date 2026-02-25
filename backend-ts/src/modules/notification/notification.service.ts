import mongoose from 'mongoose';
import { NOTIFICATION_TYPES } from '../../constants/notificationTypes';
import { calculateDistanceMeters } from '../../utils/calculateDistance';
import { BusSubscription } from '../busSubscription/busSubscription.model';
import { Stop } from '../stop/stop.model';
import { Notification } from './notification.model';
import { User } from '../user/user.model';
import { sendPushNotification } from '../../utils/sendPushNotification';

const toObjectId = (id: string) => new mongoose.Types.ObjectId(id);
const NEAR_STOP_COOLDOWN_MS = 5 * 60 * 1000;

const formatNotification = (notification: InstanceType<typeof Notification>) => ({
	id: String(notification._id),
	type: notification.type,
	title: notification.title,
	message: notification.message,
	isRead: notification.isRead,
	busId: notification.busId ? String(notification.busId) : null,
	stopId: notification.stopId ? String(notification.stopId) : null,
	payload: notification.payload || {},
	createdAt: notification.createdAt,
	updatedAt: notification.updatedAt,
});

export const notificationService = {
	getMyNotifications: async (organizationId: string, userId: string) => {
		const notifications = await Notification.find({
			organizationId: toObjectId(organizationId),
			userId: toObjectId(userId),
		})
			.sort({ createdAt: -1 })
			.limit(100);

		return notifications.map(formatNotification);
	},

	markAsRead: async (organizationId: string, userId: string, notificationId: string) => {
		const notification = await Notification.findOneAndUpdate(
			{
				_id: toObjectId(notificationId),
				organizationId: toObjectId(organizationId),
				userId: toObjectId(userId),
			},
			{ isRead: true },
			{ new: true }
		);

		if (!notification) {
			throw new Error('Notification not found');
		}

		return formatNotification(notification);
	},

	processBusLocationUpdate: async (input: {
		organizationId: string;
		busId: string;
		busNumberPlate: string;
		latitude: number;
		longitude: number;
		isBusStartedEvent: boolean;
	}) => {
		const subscriptions = await BusSubscription.find({
			organizationId: toObjectId(input.organizationId),
			busId: toObjectId(input.busId),
			isActive: true,
		}).populate('stopId', 'name latitude longitude radiusMeters');

		if (subscriptions.length === 0) {
			return;
		}

		for (const subscription of subscriptions) {
			let updatedSubscription = false;
			const user = await User.findById(subscription.userId).select('_id fcmToken');
			const fcmToken = user?.fcmToken ? String(user.fcmToken).trim() : '';

			if (input.isBusStartedEvent && subscription.notifyOnBusStart) {
				const title = 'Bus started';
				const message = `Bus ${input.busNumberPlate} has started`;

				await Notification.create({
					organizationId: subscription.organizationId,
					userId: subscription.userId,
					busId: subscription.busId,
					type: NOTIFICATION_TYPES.BUS_STARTED,
					title,
					message,
					payload: {
						busId: input.busId,
						numberPlate: input.busNumberPlate,
						latitude: input.latitude,
						longitude: input.longitude,
					},
				});

				if (fcmToken) {
					await sendPushNotification({
						fcmToken,
						title,
						body: message,
						data: {
							type: NOTIFICATION_TYPES.BUS_STARTED,
							busId: input.busId,
							numberPlate: input.busNumberPlate,
						},
					});
				}

				subscription.lastStartNotifiedAt = new Date();
				updatedSubscription = true;
			}

			if (subscription.notifyOnNearStop) {
				const stop = subscription.stopId as any;
				const targetLat =
					typeof subscription.userLatitude === 'number'
						? subscription.userLatitude
						: typeof stop?.latitude === 'number'
						  ? stop.latitude
						  : null;

				const targetLng =
					typeof subscription.userLongitude === 'number'
						? subscription.userLongitude
						: typeof stop?.longitude === 'number'
						  ? stop.longitude
						  : null;

				if (targetLat !== null && targetLng !== null) {
					const distance = calculateDistanceMeters(
						input.latitude,
						input.longitude,
						targetLat,
						targetLng
					);

					const radius =
						subscription.nearRadiusMeters ||
						(typeof stop?.radiusMeters === 'number' ? stop.radiusMeters : 150);

					const canNotifyNearStop =
						!subscription.lastNearStopNotifiedAt ||
						Date.now() - new Date(subscription.lastNearStopNotifiedAt).getTime() >=
							NEAR_STOP_COOLDOWN_MS;

					if (distance <= radius && canNotifyNearStop) {
						const stopName = stop?.name || 'your location';
						const title = 'Bus is nearby';
						const message = `Bus ${input.busNumberPlate} is near ${stopName}`;

						await Notification.create({
							organizationId: subscription.organizationId,
							userId: subscription.userId,
							busId: subscription.busId,
							stopId: stop?._id || null,
							type: NOTIFICATION_TYPES.BUS_NEAR_STOP,
							title,
							message,
							payload: {
								busId: input.busId,
								numberPlate: input.busNumberPlate,
								latitude: input.latitude,
								longitude: input.longitude,
								targetLatitude: targetLat,
								targetLongitude: targetLng,
								distanceMeters: Math.round(distance),
								radiusMeters: radius,
							},
						});

						if (fcmToken) {
							await sendPushNotification({
								fcmToken,
								title,
								body: message,
								data: {
									type: NOTIFICATION_TYPES.BUS_NEAR_STOP,
									busId: input.busId,
									numberPlate: input.busNumberPlate,
									stopName,
									distanceMeters: String(Math.round(distance)),
								},
							});
						}

						subscription.lastNearStopNotifiedAt = new Date();
						updatedSubscription = true;
					}
				}
			}

			if (updatedSubscription) {
				await subscription.save();
			}
		}
	},
};

