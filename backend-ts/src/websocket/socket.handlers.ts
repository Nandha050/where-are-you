import { Socket } from 'socket.io';
import { TRACKING_EVENTS } from '../modules/tracking/tracking.events';
import { trackingService } from '../modules/tracking/tracking.service';
import { logger } from '../utils/logger';
import { getBusRoom } from './socket.rooms';
import { ROLES } from '../constants/roles';
import { Bus } from '../modules/bus/bus.model';

interface DriverLocationPayload {
	busId: string;
	latitude: number;
	longitude: number;
}

const isValidNumber = (value: unknown): value is number =>
	typeof value === 'number' && Number.isFinite(value);

export const registerSocketHandlers = (socket: Socket): void => {
	socket.on(TRACKING_EVENTS.JOIN_BUS_ROOM, async (busId: string) => {
		try {
			if (!socket.data.user) {
				return;
			}

			if (!busId || typeof busId !== 'string') {
				return;
			}

			const trimmedBusId = busId.trim();
			const bus = await Bus.findOne({
				_id: trimmedBusId,
				organizationId: socket.data.user.organizationId,
			}).select('_id');

			if (!bus) {
				logger.warn(
					`joinBusRoom denied: socket=${socket.id}, role=${socket.data.user.role}, busId=${trimmedBusId}`
				);
				return;
			}

			socket.join(getBusRoom(trimmedBusId));
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

			const updated = await trackingService.updateMyBusLocation(
				socket.data.user.sub,
				socket.data.user.organizationId,
				payload.latitude,
				payload.longitude
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
		logger.info(`Socket client disconnected: ${socket.id}`);
	});
};
