import { Bus } from '../bus/bus.model';
import { Driver } from '../driver/driver.model';
import { LocationLog } from '../locationLog/locationLog.model';
import { TRACKING_EVENTS } from './tracking.events';
import { getBusRoom } from '../../websocket/socket.rooms';
import { getIO } from '../../websocket/socket.server';
import { ENV } from '../../config/env.config';
import { calculateDistanceMeters } from '../../utils/calculateDistance';
import { notificationService } from '../notification/notification.service';

const validateCoordinates = (latitude: number, longitude: number): void => {
	if (!Number.isFinite(latitude) || latitude < -90 || latitude > 90) {
		throw new Error('latitude must be between -90 and 90');
	}

	if (!Number.isFinite(longitude) || longitude < -180 || longitude > 180) {
		throw new Error('longitude must be between -180 and 180');
	}
};

export const trackingService = {
	updateBusLocation: async (busId: string, latitude: number, longitude: number) => {
		validateCoordinates(latitude, longitude);

		const now = new Date();
		const bus = await Bus.findById(busId);

		if (!bus) {
			throw new Error('Bus not found');
		}

		const hasPreviousLocation =
			typeof bus.currentLat === 'number' &&
			typeof bus.currentLng === 'number' &&
			Number.isFinite(bus.currentLat) &&
			Number.isFinite(bus.currentLng);

		const previousTimestamp = bus.lastUpdated ? new Date(bus.lastUpdated).getTime() : null;
		const elapsedMs = previousTimestamp ? now.getTime() - previousTimestamp : Number.MAX_SAFE_INTEGER;
		const movedMeters = hasPreviousLocation
			? calculateDistanceMeters(bus.currentLat, bus.currentLng, latitude, longitude)
			: Number.MAX_SAFE_INTEGER;

		const shouldUpdate =
			!hasPreviousLocation ||
			elapsedMs >= ENV.TRACKING_UPDATE_INTERVAL_MS ||
			movedMeters >= ENV.TRACKING_MOVEMENT_THRESHOLD_METERS;

		const wasRunning = bus.trackingStatus === 'running';

		if (!shouldUpdate) {
			return {
				busId: String(bus._id),
				latitude: bus.currentLat,
				longitude: bus.currentLng,
				recordedAt: bus.lastUpdated,
				skipped: true,
				reason: 'throttled',
				nextAllowedInMs: Math.max(0, ENV.TRACKING_UPDATE_INTERVAL_MS - elapsedMs),
			};
		}

		bus.currentLat = latitude;
		bus.currentLng = longitude;
		bus.lastUpdated = now;
		bus.trackingStatus = 'running';
		await bus.save();

		await LocationLog.create({
			organizationId: bus.organizationId,
			busId: bus._id,
			latitude,
			longitude,
			recordedAt: now,
		});

		await notificationService.processBusLocationUpdate({
			organizationId: String(bus.organizationId),
			busId: String(bus._id),
			busNumberPlate: bus.numberPlate,
			latitude,
			longitude,
			isBusStartedEvent: !wasRunning,
		});

		try {
			const io = getIO();
			io.to(getBusRoom(String(bus._id))).emit(TRACKING_EVENTS.BUS_LOCATION_UPDATE, {
				busId: String(bus._id),
				latitude,
				longitude,
				recordedAt: now.toISOString(),
			});
		} catch {
			// Socket server may not be initialized in some non-server contexts
		}

		return {
			busId: String(bus._id),
			latitude: bus.currentLat,
			longitude: bus.currentLng,
			recordedAt: now,
			skipped: false,
		};
	},

	updateMyBusLocation: async (
		driverId: string,
		organizationId: string,
		latitude: number,
		longitude: number
	) => {
		const driver = await Driver.findOne({ _id: driverId, organizationId });

		if (!driver) {
			throw new Error('Driver not found');
		}

		if (!driver.assignedBusId) {
			throw new Error('No bus assigned to this driver');
		}

		const bus = await Bus.findOne({ _id: driver.assignedBusId, organizationId });

		if (!bus) {
			throw new Error('Assigned bus not found');
		}

		return trackingService.updateBusLocation(String(bus._id), latitude, longitude);
	},
};
