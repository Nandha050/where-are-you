import { Bus } from '../bus/bus.model';
import { Driver } from '../driver/driver.model';
import { LocationLog } from '../locationLog/locationLog.model';
import { TRACKING_EVENTS } from './tracking.events';
import { getBusRoom } from '../../websocket/socket.rooms';
import { getIO } from '../../websocket/socket.server';
import { ENV } from '../../config/env.config';
import { calculateDistanceMeters } from '../../utils/calculateDistance';
import { notificationService } from '../notification/notification.service';
import { deriveBusStatusesFromDocument, setBusTripLifecycleFromEvent, syncBusDerivedStatuses } from '../bus/bus.status.workflow';
import { FLEET_STATUS, TRIP_STATUS } from '../../constants/busStatus';
import { TRACKING_STATUS, TRACKING_STATUS_LABELS } from '../../constants/trackingStatus';

const validateCoordinates = (latitude: number, longitude: number): void => {
	if (!Number.isFinite(latitude) || latitude < -90 || latitude > 90) {
		throw new Error('latitude must be between -90 and 90');
	}

	if (!Number.isFinite(longitude) || longitude < -180 || longitude > 180) {
		throw new Error('longitude must be between -180 and 180');
	}
};

const toRecordedAt = (value?: Date | string): Date => {
	if (!value) {
		return new Date();
	}

	const parsed = value instanceof Date ? value : new Date(value);
	if (Number.isNaN(parsed.getTime())) {
		throw new Error('timestamp must be a valid ISO date string');
	}

	return parsed;
};

const toTelemetrySpeed = (value: unknown): number | undefined => {
	if (typeof value !== 'number' || !Number.isFinite(value)) {
		return undefined;
	}

	return Math.max(0, value);
};

const buildRealtimePayload = (params: {
	busId: string;
	lat?: number;
	lng?: number;
	speed?: number;
	trackingStatus: string;
	tripStatus: string;
	timestamp: Date;
	skipped: boolean;
}) => ({
	busId: params.busId,
	lat: params.lat,
	lng: params.lng,
	speed: params.speed,
	status: TRACKING_STATUS_LABELS[params.trackingStatus as keyof typeof TRACKING_STATUS_LABELS] || params.trackingStatus,
	timestamp: params.timestamp.toISOString(),
	trackingStatus: params.trackingStatus,
	tripStatus: params.tripStatus,
	skipped: params.skipped,
});

export const trackingService = {
	updateBusLocation: async (
		busId: string,
		latitude: number,
		longitude: number,
		speed?: number,
		timestamp?: Date | string
	) => {
		validateCoordinates(latitude, longitude);

		const recordedAt = toRecordedAt(timestamp);
		const bus = await Bus.findById(busId);

		if (!bus) {
			throw new Error('Bus not found');
		}

		const hasPreviousLocation =
			typeof bus.currentLat === 'number' &&
			typeof bus.currentLng === 'number' &&
			Number.isFinite(bus.currentLat) &&
			Number.isFinite(bus.currentLng);

		const previousLatitude = hasPreviousLocation ? bus.currentLat : undefined;
		const previousLongitude = hasPreviousLocation ? bus.currentLng : undefined;

		const previousTimestamp = bus.lastUpdated ? new Date(bus.lastUpdated).getTime() : null;
		const elapsedMs = previousTimestamp
			? Math.max(0, recordedAt.getTime() - previousTimestamp)
			: Number.MAX_SAFE_INTEGER;
		const movedMeters =
			hasPreviousLocation &&
				typeof previousLatitude === 'number' &&
				typeof previousLongitude === 'number'
				? calculateDistanceMeters(previousLatitude, previousLongitude, latitude, longitude)
				: Number.MAX_SAFE_INTEGER;

		const shouldUpdate =
			!hasPreviousLocation ||
			elapsedMs >= ENV.TRACKING_UPDATE_INTERVAL_MS ||
			movedMeters >= ENV.TRACKING_MOVEMENT_THRESHOLD_METERS;

		const previousStatuses = deriveBusStatusesFromDocument(bus);
		const wasRunning = previousStatuses.trackingStatus === TRACKING_STATUS.RUNNING;

		if (!shouldUpdate) {
			bus.trackerOnline = true;
			bus.lastUpdated = recordedAt;

			const derivedStatuses = await syncBusDerivedStatuses(bus, {
				persist: true,
				latestTelemetry: {
					speedMps: bus.currentSpeedMps,
					timestamp: recordedAt,
					movedMeters,
				},
			});

			const heartbeatChangedStatus =
				previousStatuses.trackingStatus !== derivedStatuses.trackingStatus ||
				previousStatuses.tripStatus !== derivedStatuses.tripStatus;

			if (heartbeatChangedStatus) {
				try {
					const io = getIO();
					io.to(getBusRoom(String(bus._id))).emit(
						TRACKING_EVENTS.BUS_LOCATION_UPDATE,
						buildRealtimePayload({
							busId: String(bus._id),
							lat: bus.currentLat,
							lng: bus.currentLng,
							speed: bus.currentSpeedMps,
							trackingStatus: derivedStatuses.trackingStatus,
							tripStatus: derivedStatuses.tripStatus,
							timestamp: recordedAt,
							skipped: true,
						})
					);
				} catch {
					// Socket server may not be initialized in some non-server contexts
				}
			}

			return {
				busId: String(bus._id),
				lat: bus.currentLat,
				lng: bus.currentLng,
				speed: bus.currentSpeedMps,
				status:
					TRACKING_STATUS_LABELS[derivedStatuses.trackingStatus] ||
					derivedStatuses.trackingStatus,
				timestamp: recordedAt.toISOString(),
				latitude: bus.currentLat,
				longitude: bus.currentLng,
				recordedAt: bus.lastUpdated,
				trackingStatus: derivedStatuses.trackingStatus,
				tripStatus: derivedStatuses.tripStatus,
				skipped: true,
				reason: 'throttled',
				nextAllowedInMs: Math.max(0, ENV.TRACKING_UPDATE_INTERVAL_MS - elapsedMs),
			};
		}

		bus.currentLat = latitude;
		bus.currentLng = longitude;
		bus.lastUpdated = recordedAt;
		bus.trackerOnline = true;

		if (!bus.lastMovementAt || movedMeters >= ENV.TRACKING_MOVEMENT_THRESHOLD_METERS) {
			bus.lastMovementAt = recordedAt;
		}

		const computedSpeedMps =
			hasPreviousLocation && elapsedMs > 0
				? movedMeters / Math.max(1, elapsedMs / 1000)
				: undefined;
		const speedMps = toTelemetrySpeed(speed) ?? computedSpeedMps;

		if (typeof speedMps === 'number' && Number.isFinite(speedMps)) {
			bus.currentSpeedMps = speedMps;
		}

		if (
			bus.routeId &&
			previousStatuses.fleetStatus === FLEET_STATUS.IN_SERVICE &&
			(previousStatuses.tripStatus === TRIP_STATUS.TRIP_NOT_STARTED ||
				previousStatuses.tripStatus === TRIP_STATUS.NOT_SCHEDULED)
		) {
			setBusTripLifecycleFromEvent(bus, { type: 'trip_started', at: recordedAt });
		}

		const derivedStatuses = await syncBusDerivedStatuses(bus, {
			persist: true,
			latestTelemetry: {
				speedMps,
				timestamp: recordedAt,
				movedMeters,
			},
		});

		await LocationLog.create({
			organizationId: bus.organizationId,
			busId: bus._id,
			latitude,
			longitude,
			recordedAt,
		});

		await notificationService.processBusLocationUpdate({
			organizationId: String(bus.organizationId),
			busId: String(bus._id),
			busNumberPlate: bus.numberPlate,
			latitude,
			longitude,
			isBusStartedEvent:
				!wasRunning && derivedStatuses.trackingStatus === TRACKING_STATUS.RUNNING,
		});

		try {
			const io = getIO();
			io.to(getBusRoom(String(bus._id))).emit(
				TRACKING_EVENTS.BUS_LOCATION_UPDATE,
				buildRealtimePayload({
					busId: String(bus._id),
					lat: latitude,
					lng: longitude,
					speed: bus.currentSpeedMps,
					trackingStatus: derivedStatuses.trackingStatus,
					tripStatus: derivedStatuses.tripStatus,
					timestamp: recordedAt,
					skipped: false,
				})
			);
		} catch {
			// Socket server may not be initialized in some non-server contexts
		}

		return {
			busId: String(bus._id),
			lat: bus.currentLat,
			lng: bus.currentLng,
			speed: bus.currentSpeedMps,
			status:
				TRACKING_STATUS_LABELS[derivedStatuses.trackingStatus] ||
				derivedStatuses.trackingStatus,
			timestamp: recordedAt.toISOString(),
			latitude: bus.currentLat,
			longitude: bus.currentLng,
			recordedAt,
			trackingStatus: derivedStatuses.trackingStatus,
			tripStatus: derivedStatuses.tripStatus,
			skipped: false,
		};
	},

	updateMyBusLocation: async (
		driverId: string,
		organizationId: string,
		latitude: number,
		longitude: number,
		speed?: number,
		timestamp?: Date | string
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

		return trackingService.updateBusLocation(
			String(bus._id),
			latitude,
			longitude,
			speed,
			timestamp
		);
	},
};
