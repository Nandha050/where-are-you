export const TRACKING_EVENTS = {
	JOIN_BUS_ROOM: 'joinBusRoom',
	DRIVER_LOCATION_UPDATE: 'driverLocationUpdate',
	BUS_LOCATION_UPDATE: 'busLocationUpdate',
} as const;

export type TrackingEventName = (typeof TRACKING_EVENTS)[keyof typeof TRACKING_EVENTS];
