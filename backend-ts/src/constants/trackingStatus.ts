export const TRACKING_STATUS = {
    RUNNING: 'RUNNING',
    STOPPED: 'STOPPED',
    IDLE: 'IDLE',
    OFFLINE: 'OFFLINE',
    NO_SIGNAL: 'NO_SIGNAL',
} as const;

export type TrackingStatus = (typeof TRACKING_STATUS)[keyof typeof TRACKING_STATUS];

export const TRACKING_STATUS_VALUES: TrackingStatus[] = Object.values(TRACKING_STATUS);

export const TRACKING_STATUS_LABELS: Record<TrackingStatus, string> = {
    [TRACKING_STATUS.RUNNING]: 'Running',
    [TRACKING_STATUS.STOPPED]: 'Stopped',
    [TRACKING_STATUS.IDLE]: 'Idle',
    [TRACKING_STATUS.OFFLINE]: 'No Signal',
    [TRACKING_STATUS.NO_SIGNAL]: 'No Signal',
};
