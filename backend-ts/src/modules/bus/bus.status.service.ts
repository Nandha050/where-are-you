import {
    FLEET_STATUS,
    FLEET_STATUS_VALUES,
    FleetStatus,
    LEGACY_BUS_STATUS,
    LegacyBusStatus,
    TRIP_STATUS,
    TRIP_STATUS_VALUES,
    TripStatus,
} from '../../constants/busStatus';
import {
    TRACKING_STATUS,
    TRACKING_STATUS_VALUES,
    TrackingStatus,
} from '../../constants/trackingStatus';
import { ENV } from '../../config/env.config';

export interface RouteAssignmentContext {
    routeId?: unknown;
    isAssigned?: boolean;
}

export interface TelemetryContext {
    latitude?: number;
    longitude?: number;
    timestamp?: Date | string | number;
    speedMps?: number;
    movedMeters?: number;
    explicitlyOffline?: boolean;
}

export interface ActiveTripContext {
    isAssigned?: boolean;
    startedAt?: Date | string | number;
    endedAt?: Date | string | number;
    cancelledAt?: Date | string | number;
    isActive?: boolean;
    isCompleted?: boolean;
    isCancelled?: boolean;
    delayMinutes?: number;
}

interface BusStatusInput {
    status?: string;
    fleetStatus?: string;
    tripStatus?: string;
    trackingStatus?: string;
    maintenanceMode?: boolean;
    isMaintenance?: boolean;
    isActive?: boolean;
    disabled?: boolean;
    trackerOnline?: boolean;
    routeId?: unknown;
    currentLat?: number;
    currentLng?: number;
    currentSpeedMps?: number;
    lastUpdated?: Date | string | number;
    lastMovementAt?: Date | string | number;
}

export interface DerivedBusStatuses {
    fleetStatus: FleetStatus;
    tripStatus: TripStatus;
    trackingStatus: TrackingStatus;
    status: LegacyBusStatus;
}

const tripTransitionMap: Record<TripStatus, TripStatus[]> = {
    [TRIP_STATUS.NOT_SCHEDULED]: [
        TRIP_STATUS.TRIP_NOT_STARTED,
        TRIP_STATUS.MAINTENANCE_HOLD,
    ],
    [TRIP_STATUS.TRIP_NOT_STARTED]: [
        TRIP_STATUS.ON_TRIP,
        TRIP_STATUS.CANCELLED,
        TRIP_STATUS.NOT_SCHEDULED,
        TRIP_STATUS.MAINTENANCE_HOLD,
    ],
    [TRIP_STATUS.ON_TRIP]: [
        TRIP_STATUS.DELAYED,
        TRIP_STATUS.COMPLETED,
        TRIP_STATUS.CANCELLED,
        TRIP_STATUS.MAINTENANCE_HOLD,
    ],
    [TRIP_STATUS.COMPLETED]: [
        TRIP_STATUS.TRIP_NOT_STARTED,
        TRIP_STATUS.NOT_SCHEDULED,
        TRIP_STATUS.MAINTENANCE_HOLD,
    ],
    [TRIP_STATUS.DELAYED]: [
        TRIP_STATUS.ON_TRIP,
        TRIP_STATUS.COMPLETED,
        TRIP_STATUS.CANCELLED,
        TRIP_STATUS.MAINTENANCE_HOLD,
    ],
    [TRIP_STATUS.CANCELLED]: [
        TRIP_STATUS.TRIP_NOT_STARTED,
        TRIP_STATUS.NOT_SCHEDULED,
        TRIP_STATUS.MAINTENANCE_HOLD,
    ],
    [TRIP_STATUS.MAINTENANCE_HOLD]: [
        TRIP_STATUS.NOT_SCHEDULED,
        TRIP_STATUS.TRIP_NOT_STARTED,
    ],
};

const hasCoordinates = (latitude: unknown, longitude: unknown): boolean => {
    return (
        typeof latitude === 'number' &&
        Number.isFinite(latitude) &&
        typeof longitude === 'number' &&
        Number.isFinite(longitude)
    );
};

const toDate = (value: unknown): Date | null => {
    if (value instanceof Date) {
        return Number.isNaN(value.getTime()) ? null : value;
    }

    if (typeof value === 'string' || typeof value === 'number') {
        const parsed = new Date(value);
        return Number.isNaN(parsed.getTime()) ? null : parsed;
    }

    return null;
};

const normalizeFleetStatus = (value: unknown): FleetStatus | null => {
    if (typeof value !== 'string') {
        return null;
    }

    const normalized = value.trim().toUpperCase();
    return FLEET_STATUS_VALUES.includes(normalized as FleetStatus)
        ? (normalized as FleetStatus)
        : null;
};

const normalizeTripStatus = (value: unknown): TripStatus | null => {
    if (typeof value !== 'string') {
        return null;
    }

    const normalized = value.trim().toUpperCase();
    return TRIP_STATUS_VALUES.includes(normalized as TripStatus)
        ? (normalized as TripStatus)
        : null;
};

const normalizeTrackingStatus = (value: unknown): TrackingStatus | null => {
    if (typeof value !== 'string') {
        return null;
    }

    const normalized = value.trim().toUpperCase();

    if (normalized === 'STOPPED') {
        return TRACKING_STATUS.STOPPED;
    }

    if (normalized === 'ONLINE') {
        return TRACKING_STATUS.STOPPED;
    }

    if (normalized === 'OFFLINE') {
        return TRACKING_STATUS.NO_SIGNAL;
    }

    return TRACKING_STATUS_VALUES.includes(normalized as TrackingStatus)
        ? (normalized as TrackingStatus)
        : null;
};

export const mapLegacyStatusToFleetStatus = (
    legacyStatus?: string
): FleetStatus => {
    if (legacyStatus === LEGACY_BUS_STATUS.INACTIVE) {
        return FLEET_STATUS.OUT_OF_SERVICE;
    }

    return FLEET_STATUS.IN_SERVICE;
};

export const mapFleetStatusToLegacyStatus = (
    fleetStatus: FleetStatus
): LegacyBusStatus => {
    if (fleetStatus === FLEET_STATUS.OUT_OF_SERVICE) {
        return LEGACY_BUS_STATUS.INACTIVE;
    }

    return LEGACY_BUS_STATUS.ACTIVE;
};

export const deriveFleetStatus = (bus: BusStatusInput): FleetStatus => {
    const normalizedFleet = normalizeFleetStatus(bus.fleetStatus);
    if (normalizedFleet) {
        return normalizedFleet;
    }

    if (bus.maintenanceMode || bus.isMaintenance) {
        return FLEET_STATUS.MAINTENANCE;
    }

    if (bus.disabled || bus.isActive === false) {
        return FLEET_STATUS.OUT_OF_SERVICE;
    }

    return mapLegacyStatusToFleetStatus(bus.status);
};

const deriveRouteAssigned = (
    bus: BusStatusInput,
    routeAssignment?: RouteAssignmentContext,
    activeTrip?: ActiveTripContext
): boolean => {
    if (typeof routeAssignment?.isAssigned === 'boolean') {
        return routeAssignment.isAssigned;
    }

    if (routeAssignment?.routeId) {
        return true;
    }

    if (typeof activeTrip?.isAssigned === 'boolean') {
        return activeTrip.isAssigned;
    }

    if (activeTrip) {
        return true;
    }

    return Boolean(bus.routeId);
};

const deriveTripStatus = (
    bus: BusStatusInput,
    fleetStatus: FleetStatus,
    routeAssigned: boolean,
    activeTrip?: ActiveTripContext
): TripStatus => {
    if (fleetStatus === FLEET_STATUS.MAINTENANCE) {
        return TRIP_STATUS.MAINTENANCE_HOLD;
    }

    const normalizedTrip = normalizeTripStatus(bus.tripStatus);

    if (activeTrip?.isCancelled || toDate(activeTrip?.cancelledAt)) {
        return TRIP_STATUS.CANCELLED;
    }

    if (activeTrip?.isCompleted || toDate(activeTrip?.endedAt)) {
        return TRIP_STATUS.COMPLETED;
    }

    const startedAt = toDate(activeTrip?.startedAt);
    const isActiveTrip = Boolean(
        activeTrip?.isActive || (startedAt && !activeTrip?.isCompleted && !activeTrip?.isCancelled)
    );

    if (isActiveTrip) {
        const delayedByThreshold =
            typeof activeTrip?.delayMinutes === 'number' &&
            activeTrip.delayMinutes >= ENV.TRIP_DELAY_THRESHOLD_MINUTES;

        return delayedByThreshold ? TRIP_STATUS.DELAYED : TRIP_STATUS.ON_TRIP;
    }

    if (!routeAssigned) {
        return TRIP_STATUS.NOT_SCHEDULED;
    }

    if (normalizedTrip && normalizedTrip !== TRIP_STATUS.NOT_SCHEDULED) {
        return normalizedTrip;
    }

    return TRIP_STATUS.TRIP_NOT_STARTED;
};

export const deriveTrackingStatus = (
    bus: BusStatusInput,
    latestTelemetry?: TelemetryContext,
    now: Date = new Date()
): TrackingStatus => {
    if (latestTelemetry?.explicitlyOffline || bus.trackerOnline === false) {
        return TRACKING_STATUS.NO_SIGNAL;
    }

    const telemetryTimestamp =
        toDate(latestTelemetry?.timestamp) ??
        toDate(bus.lastUpdated);

    const latitude =
        typeof latestTelemetry?.latitude === 'number'
            ? latestTelemetry.latitude
            : bus.currentLat;
    const longitude =
        typeof latestTelemetry?.longitude === 'number'
            ? latestTelemetry.longitude
            : bus.currentLng;

    if (!telemetryTimestamp || !hasCoordinates(latitude, longitude)) {
        return TRACKING_STATUS.NO_SIGNAL;
    }

    const ageMs = now.getTime() - telemetryTimestamp.getTime();
    if (ageMs > ENV.TRACKING_STALE_THRESHOLD_MS) {
        return TRACKING_STATUS.NO_SIGNAL;
    }

    const speedMps =
        typeof latestTelemetry?.speedMps === 'number'
            ? latestTelemetry.speedMps
            : typeof bus.currentSpeedMps === 'number'
                ? bus.currentSpeedMps
                : 0;

    if (speedMps > ENV.TRACKING_RUNNING_SPEED_MPS) {
        return TRACKING_STATUS.RUNNING;
    }

    const lastMovementAt = toDate(bus.lastMovementAt) ?? telemetryTimestamp;
    const noMovementMs = Math.max(0, now.getTime() - lastMovementAt.getTime());
    const movedMeters = latestTelemetry?.movedMeters;
    const isStationaryByDistance =
        typeof movedMeters === 'number'
            ? movedMeters <= ENV.TRACKING_IDLE_MOVEMENT_EPSILON_METERS
            : true;

    if (
        speedMps === 0 &&
        isStationaryByDistance &&
        noMovementMs > ENV.TRACKING_IDLE_NO_MOVEMENT_MS
    ) {
        return TRACKING_STATUS.IDLE;
    }

    if (ageMs < ENV.TRACKING_STOPPED_FRESH_THRESHOLD_MS) {
        return TRACKING_STATUS.STOPPED;
    }

    const normalized = normalizeTrackingStatus(bus.trackingStatus);
    if (
        normalized === TRACKING_STATUS.RUNNING ||
        normalized === TRACKING_STATUS.STOPPED ||
        normalized === TRACKING_STATUS.IDLE
    ) {
        return normalized;
    }

    return TRACKING_STATUS.STOPPED;
};

export const deriveBusStatuses = (
    bus: BusStatusInput,
    routeAssignment?: RouteAssignmentContext,
    latestTelemetry?: TelemetryContext,
    activeTrip?: ActiveTripContext,
    now: Date = new Date()
): DerivedBusStatuses => {
    const fleetStatus = deriveFleetStatus(bus);
    const routeAssigned = deriveRouteAssigned(bus, routeAssignment, activeTrip);
    const tripStatus = deriveTripStatus(bus, fleetStatus, routeAssigned, activeTrip);
    const trackingStatus = deriveTrackingStatus(bus, latestTelemetry, now);

    return {
        fleetStatus,
        tripStatus,
        trackingStatus,
        status: mapFleetStatusToLegacyStatus(fleetStatus),
    };
};

export const deriveDefaultTripStatus = (bus: BusStatusInput): TripStatus => {
    const fleetStatus = deriveFleetStatus(bus);

    if (fleetStatus === FLEET_STATUS.MAINTENANCE) {
        return TRIP_STATUS.MAINTENANCE_HOLD;
    }

    if (!bus.routeId) {
        return TRIP_STATUS.NOT_SCHEDULED;
    }

    return TRIP_STATUS.TRIP_NOT_STARTED;
};

export const assertValidTripStatusTransition = (
    currentTripStatus: TripStatus,
    nextTripStatus: TripStatus,
    options: {
        fleetStatus: FleetStatus;
        routeAssigned: boolean;
        routeRemoved?: boolean;
    }
): void => {
    if (
        nextTripStatus === TRIP_STATUS.ON_TRIP &&
        (options.fleetStatus === FLEET_STATUS.MAINTENANCE ||
            options.fleetStatus === FLEET_STATUS.OUT_OF_SERVICE)
    ) {
        throw new Error(
            `Invalid trip status transition: ${currentTripStatus} -> ${nextTripStatus}. Fleet status ${options.fleetStatus} cannot start a trip.`
        );
    }

    if (
        currentTripStatus === TRIP_STATUS.ON_TRIP &&
        nextTripStatus === TRIP_STATUS.NOT_SCHEDULED &&
        !options.routeRemoved
    ) {
        throw new Error(
            'Invalid trip status transition: ON_TRIP -> NOT_SCHEDULED requires route removal.'
        );
    }

    if (!options.routeAssigned && nextTripStatus === TRIP_STATUS.TRIP_NOT_STARTED) {
        throw new Error(
            'Invalid trip status transition: TRIP_NOT_STARTED requires an assigned route.'
        );
    }

    const allowedNextStatuses = tripTransitionMap[currentTripStatus] || [];
    if (!allowedNextStatuses.includes(nextTripStatus) && currentTripStatus !== nextTripStatus) {
        throw new Error(
            `Invalid trip status transition: ${currentTripStatus} -> ${nextTripStatus} is not allowed.`
        );
    }
};