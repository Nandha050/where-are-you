export const LEGACY_BUS_STATUS = {
    ACTIVE: 'active',
    INACTIVE: 'inactive',
} as const;

export type LegacyBusStatus = (typeof LEGACY_BUS_STATUS)[keyof typeof LEGACY_BUS_STATUS];

export const FLEET_STATUS = {
    IN_SERVICE: 'IN_SERVICE',
    OUT_OF_SERVICE: 'OUT_OF_SERVICE',
    MAINTENANCE: 'MAINTENANCE',
} as const;

export type FleetStatus = (typeof FLEET_STATUS)[keyof typeof FLEET_STATUS];

export const FLEET_STATUS_VALUES: FleetStatus[] = Object.values(FLEET_STATUS);

export const TRIP_STATUS = {
    NOT_SCHEDULED: 'NOT_SCHEDULED',
    TRIP_NOT_STARTED: 'TRIP_NOT_STARTED',
    ON_TRIP: 'ON_TRIP',
    COMPLETED: 'COMPLETED',
    DELAYED: 'DELAYED',
    CANCELLED: 'CANCELLED',
    MAINTENANCE_HOLD: 'MAINTENANCE_HOLD',
} as const;

export type TripStatus = (typeof TRIP_STATUS)[keyof typeof TRIP_STATUS];

export const TRIP_STATUS_VALUES: TripStatus[] = Object.values(TRIP_STATUS);
