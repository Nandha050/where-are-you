export const TRIP_STATUS = {
    PENDING: 'PENDING',
    STARTED: 'STARTED',
    RUNNING: 'RUNNING',
    STOPPED: 'STOPPED',
    COMPLETED: 'COMPLETED',
    CANCELLED: 'CANCELLED',
} as const;

export type TripStatus = (typeof TRIP_STATUS)[keyof typeof TRIP_STATUS];

export const TRIP_STATUS_VALUES: TripStatus[] = Object.values(TRIP_STATUS);

export const ACTIVE_TRIP_TERMINAL_STATUSES: TripStatus[] = [
    TRIP_STATUS.COMPLETED,
    TRIP_STATUS.CANCELLED,
];
