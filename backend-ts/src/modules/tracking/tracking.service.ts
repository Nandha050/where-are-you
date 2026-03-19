import { Bus } from '../bus/bus.model';
import { Driver } from '../driver/driver.model';
import { LocationLog } from '../locationLog/locationLog.model';
import { TRACKING_EVENTS } from './tracking.events';
import { getBusRoom } from '../../websocket/socket.rooms';
import { getIO } from '../../websocket/socket.server';
import { ENV } from '../../config/env.config';
import { calculateDistanceMeters } from '../../utils/calculateDistance';
import { notificationService } from '../notification/notification.service';
import { tripService } from '../trip/trip.service';

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
    tripStatus: string | null;
    timestamp: Date;
    skipped: boolean;
}) => ({
    busId: params.busId,
    lat: params.lat,
    lng: params.lng,
    speed: params.speed,
    status: params.tripStatus,
    timestamp: params.timestamp.toISOString(),
    trackingStatus: params.tripStatus,
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
        const bus = await Bus.findById(busId).select('_id organizationId driverId');
        if (!bus) {
            throw new Error('Bus not found');
        }

        if (!bus.driverId) {
            throw new Error('No driver assigned to this bus');
        }

        return trackingService.updateMyBusLocation(
            String(bus.driverId),
            String(bus.organizationId),
            latitude,
            longitude,
            speed,
            timestamp
        );
    },

    updateMyBusLocation: async (
        driverId: string,
        organizationId: string,
        latitude: number,
        longitude: number,
        speed?: number,
        timestamp?: Date | string
    ) => {
        validateCoordinates(latitude, longitude);

        const recordedAt = toRecordedAt(timestamp);
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

        if (!shouldUpdate) {
            const activeTrip = await tripService.getActiveTripByDriverId(driverId, organizationId);
            if (!activeTrip) {
                throw new Error('No active trip found for this driver');
            }
            const tripStatus = activeTrip?.status || null;

            return {
                busId: String(bus._id),
                lat: bus.currentLat,
                lng: bus.currentLng,
                speed: bus.currentSpeedMps,
                status: tripStatus,
                timestamp: recordedAt.toISOString(),
                latitude: bus.currentLat,
                longitude: bus.currentLng,
                recordedAt: bus.lastUpdated,
                trackingStatus: tripStatus,
                tripStatus,
                activeTrip,
                skipped: true,
                reason: 'throttled',
                nextAllowedInMs: Math.max(0, ENV.TRACKING_UPDATE_INTERVAL_MS - elapsedMs),
            };
        }

        const computedSpeedMps =
            hasPreviousLocation && elapsedMs > 0
                ? movedMeters / Math.max(1, elapsedMs / 1000)
                : 0;
        const speedMps = toTelemetrySpeed(speed) ?? computedSpeedMps;

        const tripUpdate = await tripService.updateActiveTripLocationByDriver(
            driverId,
            organizationId,
            { lat: latitude, lng: longitude },
            speedMps,
            recordedAt
        );

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
            isBusStartedEvent: tripUpdate.isBusStartedEvent,
        });

        try {
            const io = getIO();
            io.to(getBusRoom(String(bus._id))).emit(
                TRACKING_EVENTS.BUS_LOCATION_UPDATE,
                buildRealtimePayload({
                    busId: String(bus._id),
                    lat: latitude,
                    lng: longitude,
                    speed: speedMps,
                    tripStatus: tripUpdate.trip.status,
                    timestamp: recordedAt,
                    skipped: false,
                })
            );
        } catch {
            // Socket server may not be initialized in some non-server contexts
        }

        return {
            busId: String(bus._id),
            lat: latitude,
            lng: longitude,
            speed: speedMps,
            status: tripUpdate.trip.status,
            timestamp: recordedAt.toISOString(),
            latitude,
            longitude,
            recordedAt,
            trackingStatus: tripUpdate.trip.status,
            tripStatus: tripUpdate.trip.status,
            activeTrip: tripUpdate.trip,
            skipped: false,
        };
    },
};
