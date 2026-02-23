import axios from 'axios';
import { Route } from './route.model';
import { ENV } from '../../config/env.config';

const DIRECTIONS_URL = 'https://maps.googleapis.com/maps/api/directions/json';

interface CreateRouteInput {
    name: string;
    startLat: number;
    startLng: number;
    endLat: number;
    endLng: number;
}

interface DirectionsResponse {
    status: string;
    routes: Array<{
        overview_polyline: { points: string };
        legs: Array<{
            distance: { value: number };
            duration: { value: number };
        }>;
    }>;
    error_message?: string;
}

export const routeService = {
    createRoute: async (organizationId: string, input: CreateRouteInput) => {
        const existing = await Route.findOne({ organizationId, name: input.name });
        if (existing) {
            throw new Error(`Route with name "${input.name}" already exists`);
        }

        if (!ENV.GOOGLE_MAPS_API_KEY) {
            throw new Error('Google Maps API key is not configured');
        }

        const { data } = await axios.get<DirectionsResponse>(DIRECTIONS_URL, {
            params: {
                origin: `${input.startLat},${input.startLng}`,
                destination: `${input.endLat},${input.endLng}`,
                key: ENV.GOOGLE_MAPS_API_KEY,
            },
        });

        if (data.status !== 'OK' || data.routes.length === 0) {
            throw new Error(
                data.error_message || `Google Directions API returned status: ${data.status}`
            );
        }

        const result = data.routes[0];
        const leg = result.legs[0];

        const route = await Route.create({
            organizationId,
            name: input.name.trim(),
            encodedPolyline: result.overview_polyline.points,
            totalDistanceMeters: leg.distance.value,
            estimatedDurationSeconds: leg.duration.value,
        });

        return formatRoute(route);
    },

    getRoutes: async (organizationId: string) => {
        const routes = await Route.find({ organizationId }).sort({ createdAt: -1 });
        return routes.map(formatRoute);
    },

    getRouteById: async (organizationId: string, routeId: string) => {
        const route = await Route.findOne({ _id: routeId, organizationId });
        if (!route) {
            throw new Error('Route not found');
        }
        return formatRoute(route);
    },

    deleteRoute: async (organizationId: string, routeId: string) => {
        const route = await Route.findOneAndDelete({ _id: routeId, organizationId });
        if (!route) {
            throw new Error('Route not found');
        }
        return { message: 'Route deleted successfully' };
    },
};

const formatRoute = (route: InstanceType<typeof Route>) => ({
    id: String(route._id),
    name: route.name,
    encodedPolyline: route.encodedPolyline,
    totalDistanceMeters: route.totalDistanceMeters,
    estimatedDurationSeconds: route.estimatedDurationSeconds,
    isActive: route.isActive,
    createdAt: route.createdAt,
    updatedAt: route.updatedAt,
});
