import { getIO } from '../websocket/socket.server';
import { logger } from '../utils/logger';
import { TRACKING_EVENTS } from '../modules/tracking/tracking.events';
import { getBusRoom, getTripRoom, getRouteRoom } from '../websocket/socket.rooms';

export interface BusLocationBroadcast {
    busId: string;
    tripId?: string;
    latitude: number;
    longitude: number;
    speed?: number;
    heading?: number;
    accuracy?: number;
    timestamp: string;
    eta?: string;
}

export interface StopUpdateBroadcast {
    busId: string;
    tripId: string;
    currentStopId: string;
    nextStopId?: string;
    timestamp: string;
    stopName?: string;
}

export interface EtaBroadcast {
    busId: string;
    tripId: string;
    estimatedArrival: string;
    distanceMeters: number;
    durationSeconds: number;
}

export interface NotificationBroadcast {
    type: 'bus_arriving' | 'bus_at_stop' | 'bus_delayed' | 'custom';
    title: string;
    message: string;
    busId: string;
    tripId: string;
    timestamp: string;
    data?: Record<string, unknown>;
}

// room name helpers are imported from websocket/socket.rooms

export const broadcastService = {
    /**
     * Broadcast location update to passengers on trip
     * CRITICAL: Only for PASSENGER apps, NOT driver sockets
     */
    broadcastBusLocation(tripId: string, locationData: BusLocationBroadcast): void {
        try {
            const io = getIO();

            // Normalize payload to always include `lat` and `lng` keys (frontend expectation)
            const lat = (locationData as any).lat ?? (locationData as any).latitude ?? locationData.latitude;
            const lng = (locationData as any).lng ?? (locationData as any).longitude ?? locationData.longitude;

            const payload = {
                busId: locationData.busId,
                tripId: locationData.tripId,
                lat,
                lng,
                speed: locationData.speed,
                heading: locationData.heading,
                accuracy: locationData.accuracy,
                timestamp: locationData.timestamp,
                broadcastTimestamp: new Date().toISOString(),
            };

            // Emit to trip room
            const tripRoom = getTripRoom(tripId);
            io.to(tripRoom).emit(TRACKING_EVENTS.BUS_LOCATION_UPDATE, payload);
            console.log('[ROOM EMIT]', { roomId: tripRoom, event: TRACKING_EVENTS.BUS_LOCATION_UPDATE, socketId: io ? 'io' : 'no-io', timestamp: new Date().toISOString() });
            logger.debug(`Broadcast location to trip room ${tripRoom}`);

            // Also emit to bus room in case clients joined by bus id
            const busRoom = getBusRoom(locationData.busId);
            io.to(busRoom).emit(TRACKING_EVENTS.BUS_LOCATION_UPDATE, payload);
            console.log('[ROOM EMIT]', { roomId: busRoom, event: TRACKING_EVENTS.BUS_LOCATION_UPDATE, socketId: io ? 'io' : 'no-io', timestamp: new Date().toISOString() });
            logger.debug(`Broadcast location to bus room ${busRoom}`);
        } catch (error) {
            const message = error instanceof Error ? error.message : 'Unknown error';
            logger.warn(`Failed to broadcast location: ${message}`);
        }
    },

    /**
     * Broadcast to specific route room (for route-level subscribers)
     */
    broadcastToRoute(routeId: string, event: string, data: Record<string, unknown>): void {
        try {
            const io = getIO();
            const room = getRouteRoom(routeId);

            io.to(room).emit(event, {
                ...data,
                broadcastTimestamp: new Date().toISOString(),
            });

            logger.debug(`Broadcast event ${event} to route room ${room}`);
        } catch (error) {
            const message = error instanceof Error ? error.message : 'Unknown error';
            logger.warn(`Failed to broadcast to route: ${message}`);
        }
    },

    /**
     * Broadcast stop update (bus reached stop)
     */
    broadcastStopUpdate(tripId: string, stopData: StopUpdateBroadcast): void {
        try {
            const io = getIO();
            const room = getTripRoom(tripId);

            io.to(room).emit('stopUpdate', {
                ...stopData,
                broadcastTimestamp: new Date().toISOString(),
            });

            logger.debug(`Broadcast stop update to trip room ${room}`);
        } catch (error) {
            const message = error instanceof Error ? error.message : 'Unknown error';
            logger.warn(`Failed to broadcast stop update: ${message}`);
        }
    },

    /**
     * Broadcast ETA update
     */
    broadcastEtaUpdate(tripId: string, etaData: EtaBroadcast): void {
        try {
            const io = getIO();
            const room = getTripRoom(tripId);

            io.to(room).emit('etaUpdate', {
                ...etaData,
                broadcastTimestamp: new Date().toISOString(),
            });

            logger.debug(`Broadcast ETA update to trip room ${room}`);
        } catch (error) {
            const message = error instanceof Error ? error.message : 'Unknown error';
            logger.warn(`Failed to broadcast ETA update: ${message}`);
        }
    },

    /**
     * Broadcast notification to trip subscribers
     */
    broadcastNotification(tripId: string, notification: NotificationBroadcast): void {
        try {
            const io = getIO();
            const room = getTripRoom(tripId);

            io.to(room).emit('notification', {
                ...notification,
                broadcastTimestamp: new Date().toISOString(),
            });

            logger.debug(`Broadcast notification to trip room ${room}: ${notification.title}`);
        } catch (error) {
            const message = error instanceof Error ? error.message : 'Unknown error';
            logger.warn(`Failed to broadcast notification: ${message}`);
        }
    },

    /**
     * Broadcast generic event to trip
     */
    broadcastToTrip(tripId: string, event: string, data: Record<string, unknown>): void {
        try {
            const io = getIO();
            const room = getTripRoom(tripId);

            io.to(room).emit(event, {
                ...data,
                broadcastTimestamp: new Date().toISOString(),
            });

            logger.debug(`Broadcast event ${event} to trip room ${room}`);
        } catch (error) {
            const message = error instanceof Error ? error.message : 'Unknown error';
            logger.warn(`Failed to broadcast to trip: ${message}`);
        }
    },

    /**
     * Get room name for trip
     */
    getTripRoom(tripId: string): string {
        return getTripRoom(tripId);
    },

    /**
     * Get room name for bus
     */
    getBusRoom(busId: string): string {
        return getBusRoom(busId);
    },

    /**
     * Get room name for route
     */
    getRouteRoom(routeId: string): string {
        return getRouteRoom(routeId);
    },
};
