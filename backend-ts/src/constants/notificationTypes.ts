export const NOTIFICATION_TYPES = {
	BUS_STARTED: 'bus_started',
	BUS_NEAR_STOP: 'bus_near_stop',
} as const;

export type NotificationType = (typeof NOTIFICATION_TYPES)[keyof typeof NOTIFICATION_TYPES];

