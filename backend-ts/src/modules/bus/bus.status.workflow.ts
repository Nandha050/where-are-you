import { IBus } from './bus.model';
import { FLEET_STATUS, TRIP_STATUS, TripStatus } from '../../constants/busStatus';
import {
    ActiveTripContext,
    assertValidTripStatusTransition,
    deriveBusStatuses,
    deriveFleetStatus,
} from './bus.status.service';

type BusStatusLike = Pick<
    IBus,
    | 'routeId'
    | 'currentLat'
    | 'currentLng'
    | 'lastUpdated'
    | 'lastMovementAt'
    | 'currentSpeedMps'
    | 'trackerOnline'
    | 'tripStartedAt'
    | 'tripEndedAt'
    | 'tripCancelledAt'
    | 'tripDelayMinutes'
    | 'tripStatus'
    | 'fleetStatus'
    | 'status'
    | 'trackingStatus'
    | 'maintenanceMode'
>
    & {
        isActive?: boolean;
        disabled?: boolean;
    };

const asDate = (value: unknown): Date | undefined => {
    if (!value) {
        return undefined;
    }

    const parsed = value instanceof Date ? value : new Date(value as string);
    return Number.isNaN(parsed.getTime()) ? undefined : parsed;
};

const toActiveTripContext = (bus: BusStatusLike): ActiveTripContext => ({
    isAssigned: Boolean(bus.routeId),
    startedAt: bus.tripStartedAt,
    endedAt: bus.tripEndedAt,
    cancelledAt: bus.tripCancelledAt,
    isActive: bus.tripStatus === TRIP_STATUS.ON_TRIP || bus.tripStatus === TRIP_STATUS.DELAYED,
    isCompleted: bus.tripStatus === TRIP_STATUS.COMPLETED,
    isCancelled: bus.tripStatus === TRIP_STATUS.CANCELLED,
    delayMinutes: bus.tripDelayMinutes,
});

export const deriveBusStatusesFromDocument = (bus: BusStatusLike) => {
    return deriveBusStatuses(
        bus,
        {
            routeId: bus.routeId,
            isAssigned: Boolean(bus.routeId),
        },
        {
            latitude: bus.currentLat,
            longitude: bus.currentLng,
            timestamp: bus.lastUpdated,
            speedMps: bus.currentSpeedMps,
            explicitlyOffline: bus.trackerOnline === false,
        },
        toActiveTripContext(bus)
    );
};

export const syncBusDerivedStatuses = async (
    bus: IBus,
    options?: {
        persist?: boolean;
        latestTelemetry?: { speedMps?: number; timestamp?: Date; movedMeters?: number };
    }
) => {
    const derived = deriveBusStatuses(
        bus,
        {
            routeId: bus.routeId,
            isAssigned: Boolean(bus.routeId),
        },
        {
            latitude: bus.currentLat,
            longitude: bus.currentLng,
            timestamp: options?.latestTelemetry?.timestamp || bus.lastUpdated,
            speedMps:
                typeof options?.latestTelemetry?.speedMps === 'number'
                    ? options.latestTelemetry.speedMps
                    : bus.currentSpeedMps,
            movedMeters: options?.latestTelemetry?.movedMeters,
            explicitlyOffline: bus.trackerOnline === false,
        },
        toActiveTripContext(bus)
    );

    let changed = false;

    if (bus.status !== derived.status) {
        bus.status = derived.status;
        changed = true;
    }

    if (bus.fleetStatus !== derived.fleetStatus) {
        bus.fleetStatus = derived.fleetStatus;
        changed = true;
    }

    if (bus.tripStatus !== derived.tripStatus) {
        bus.tripStatus = derived.tripStatus;
        changed = true;
    }

    if (bus.trackingStatus !== derived.trackingStatus) {
        bus.trackingStatus = derived.trackingStatus;
        changed = true;
    }

    if (changed && options?.persist) {
        await bus.save();
    }

    return {
        ...derived,
        changed,
    };
};

export const transitionBusTripStatus = (
    bus: IBus,
    nextTripStatus: TripStatus,
    options?: {
        routeRemoved?: boolean;
        delayMinutes?: number;
        eventAt?: Date;
    }
): void => {
    const currentTripStatus = bus.tripStatus || deriveBusStatusesFromDocument(bus).tripStatus;
    const fleetStatus = deriveFleetStatus(bus);

    assertValidTripStatusTransition(currentTripStatus, nextTripStatus, {
        fleetStatus,
        routeAssigned: Boolean(bus.routeId),
        routeRemoved: options?.routeRemoved,
    });

    const eventAt = options?.eventAt || new Date();

    if (nextTripStatus === TRIP_STATUS.ON_TRIP || nextTripStatus === TRIP_STATUS.DELAYED) {
        bus.tripStartedAt = bus.tripStartedAt || eventAt;
        bus.tripEndedAt = undefined;
        bus.tripCancelledAt = undefined;
    }

    if (nextTripStatus === TRIP_STATUS.COMPLETED) {
        bus.tripEndedAt = eventAt;
    }

    if (nextTripStatus === TRIP_STATUS.CANCELLED) {
        bus.tripCancelledAt = eventAt;
    }

    if (
        nextTripStatus === TRIP_STATUS.TRIP_NOT_STARTED ||
        nextTripStatus === TRIP_STATUS.NOT_SCHEDULED ||
        nextTripStatus === TRIP_STATUS.MAINTENANCE_HOLD
    ) {
        bus.tripStartedAt = undefined;
        bus.tripEndedAt = undefined;
        bus.tripCancelledAt = undefined;
        bus.tripDelayMinutes = undefined;
    }

    if (typeof options?.delayMinutes === 'number') {
        bus.tripDelayMinutes = options.delayMinutes;
    }

    bus.tripStatus = nextTripStatus;
};

export const applyRouteAssignmentStatus = (bus: IBus): void => {
    if (!bus.routeId) {
        transitionBusTripStatus(bus, TRIP_STATUS.NOT_SCHEDULED, { routeRemoved: true });
        return;
    }

    const fleetStatus = deriveFleetStatus(bus);

    if (fleetStatus === FLEET_STATUS.MAINTENANCE) {
        transitionBusTripStatus(bus, TRIP_STATUS.MAINTENANCE_HOLD);
        return;
    }

    transitionBusTripStatus(bus, TRIP_STATUS.TRIP_NOT_STARTED);
};

export const applyMaintenanceModeStatus = (bus: IBus, maintenanceMode: boolean): void => {
    bus.maintenanceMode = maintenanceMode;

    if (maintenanceMode) {
        bus.fleetStatus = FLEET_STATUS.MAINTENANCE;
        transitionBusTripStatus(bus, TRIP_STATUS.MAINTENANCE_HOLD);
        return;
    }

    const routeAssigned = Boolean(bus.routeId);
    const nextTripStatus = routeAssigned
        ? TRIP_STATUS.TRIP_NOT_STARTED
        : TRIP_STATUS.NOT_SCHEDULED;

    transitionBusTripStatus(bus, nextTripStatus, { routeRemoved: !routeAssigned });
};

export const setBusTripLifecycleFromEvent = (
    bus: IBus,
    event:
        | { type: 'trip_started'; at?: Date }
        | { type: 'trip_completed'; at?: Date }
        | { type: 'trip_cancelled'; at?: Date }
        | { type: 'trip_delayed'; at?: Date; delayMinutes: number }
): void => {
    if (event.type === 'trip_started') {
        transitionBusTripStatus(bus, TRIP_STATUS.ON_TRIP, { eventAt: asDate(event.at) });
        return;
    }

    if (event.type === 'trip_completed') {
        transitionBusTripStatus(bus, TRIP_STATUS.COMPLETED, { eventAt: asDate(event.at) });
        return;
    }

    if (event.type === 'trip_cancelled') {
        transitionBusTripStatus(bus, TRIP_STATUS.CANCELLED, { eventAt: asDate(event.at) });
        return;
    }

    transitionBusTripStatus(bus, TRIP_STATUS.DELAYED, {
        eventAt: asDate(event.at),
        delayMinutes: event.delayMinutes,
    });
};