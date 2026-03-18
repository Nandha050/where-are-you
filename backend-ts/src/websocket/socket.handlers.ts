import { Socket } from 'socket.io';
import mongoose from 'mongoose';
import { TRACKING_EVENTS } from '../modules/tracking/tracking.events';
import { trackingService } from '../modules/tracking/tracking.service';
import { logger } from '../utils/logger';
import { getBusRoom } from './socket.rooms';
import { ROLES } from '../constants/roles';
import { Bus } from '../modules/bus/bus.model';
import { driverService } from '../modules/driver/driver.service';

interface DriverLocationPayload {
	busId: string;
	latitude: number;
	longitude: number;
	speed?: number;
	timestamp?: string;
}

const isValidNumber = (value: unknown): value is number =>
	typeof value === 'number' && Number.isFinite(value);

const escapeRegex = (value: string): string =>
	value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

export const registerSocketHandlers = (socket: Socket): void => {
	if (socket.data.user?.role === ROLES.DRIVER) {
		void driverService
			.syncTripStatusWithSocketConnection(
				socket.data.user.sub,
				socket.data.user.organizationId,
				true
			)
			.catch((error) => {
				const message = error instanceof Error ? error.message : 'Unknown socket error';
				logger.warn(`driver connect status sync failed for socket ${socket.id}: ${message}`);
			});
	}

	socket.on(TRACKING_EVENTS.JOIN_BUS_ROOM, async (busId: string) => {
		try {
			if (!socket.data.user) {
				return;
			}

			if (!busId || typeof busId !== 'string') {
				return;
			}

			const trimmedBusId = busId.trim();
			const busSelectors: Array<Record<string, unknown>> = [
				{ numberPlate: new RegExp(`^${escapeRegex(trimmedBusId)}$`, 'i') },
			];

			if (mongoose.isValidObjectId(trimmedBusId)) {
				busSelectors.unshift({ _id: trimmedBusId });
			}

			const bus = await Bus.findOne({
				organizationId: socket.data.user.organizationId,
				$or: busSelectors,
			}).select('_id numberPlate');

			if (!bus) {
				logger.warn(
					`joinBusRoom denied: socket=${socket.id}, role=${socket.data.user.role}, busRef=${trimmedBusId}`
				);
				return;
			}

			socket.join(getBusRoom(String(bus._id)));
		} catch (error) {
			const message = error instanceof Error ? error.message : 'Unknown socket error';
			logger.warn(`joinBusRoom failed for socket ${socket.id}: ${message}`);
		}
	});

	socket.on(TRACKING_EVENTS.DRIVER_LOCATION_UPDATE, async (payload: DriverLocationPayload) => {
		try {
			if (!socket.data.user) {
				return;
			}

			if (socket.data.user.role !== ROLES.DRIVER) {
				logger.warn(`Unauthorized role for location update: socket=${socket.id}, role=${socket.data.user.role}`);
				return;
			}

			if (
				!payload ||
				!isValidNumber(payload.latitude) ||
				!isValidNumber(payload.longitude)
			) {
				return;
			}

			if (typeof payload.speed !== 'undefined' && !isValidNumber(payload.speed)) {
				return;
			}

			let recordedAt: Date | undefined;
			if (typeof payload.timestamp === 'string' && payload.timestamp.trim().length > 0) {
				recordedAt = new Date(payload.timestamp);
				if (Number.isNaN(recordedAt.getTime())) {
					return;
				}
			}

			const updated = await trackingService.updateMyBusLocation(
				socket.data.user.sub,
				socket.data.user.organizationId,
				payload.latitude,
				payload.longitude,
				payload.speed,
				recordedAt
			);

			if (payload.busId && payload.busId.trim() && payload.busId.trim() !== updated.busId) {
				logger.warn(
					`driverLocationUpdate busId mismatch: socket=${socket.id}, payload=${payload.busId}, assigned=${updated.busId}`
				);
			}
		} catch (error) {
			const message = error instanceof Error ? error.message : 'Unknown socket error';
			logger.warn(`driverLocationUpdate failed for socket ${socket.id}: ${message}`);
		}
	});

	socket.on('disconnect', () => {
		if (socket.data.user?.role === ROLES.DRIVER) {
			const hasOtherDriverSockets = Array.from(socket.nsp.sockets.values()).some((connectedSocket) =>
				connectedSocket.id !== socket.id &&
				connectedSocket.data.user?.role === ROLES.DRIVER &&
				connectedSocket.data.user?.sub === socket.data.user?.sub &&
				connectedSocket.data.user?.organizationId === socket.data.user?.organizationId
			);

			if (!hasOtherDriverSockets) {
				void driverService
					.syncTripStatusWithSocketConnection(
						socket.data.user.sub,
						socket.data.user.organizationId,
						false
					)
					.catch((error) => {
						const message = error instanceof Error ? error.message : 'Unknown socket error';
						logger.warn(`driver disconnect status sync failed for socket ${socket.id}: ${message}`);
					});
			}
		}

		logger.info(`Socket client disconnected: ${socket.id}`);
	});
};
