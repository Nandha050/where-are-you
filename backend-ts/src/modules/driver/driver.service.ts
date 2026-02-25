import { Driver } from './driver.model';
import { Bus } from '../bus/bus.model';
import { Route } from '../route/route.model';
import { Stop } from '../stop/stop.model';

export const driverService = {
    listDriversByOrganization: async (organizationId: string) => {
        const drivers = await Driver.find({ organizationId })
            .select('_id name memberId')
            .sort({ name: 1 });

        return drivers.map((driver) => ({
            id: String(driver._id),
            name: driver.name,
            memberId: driver.memberId,
        }));
    },
    getMyDetails: async (driverId: string) => {
        const driver = await Driver.findById(driverId).populate('assignedBusId', 'numberPlate status currentLat currentLng');

        if (!driver) {
            throw new Error('Driver not found');
        }

        const assignedBus = driver.assignedBusId as any;

        return {
            id: String(driver._id),
            name: driver.name,
            memberId: driver.memberId,
            organizationId: String(driver.organizationId),
            assignedBus: assignedBus
                ? {
                    id: String(assignedBus._id),
                    numberPlate: assignedBus.numberPlate,
                    status: assignedBus.status,
                    currentLat: assignedBus.currentLat,
                    currentLng: assignedBus.currentLng,
                }
                : null,
        };
    },

    getMyBus: async (driverId: string) => {
        const driver = await Driver.findById(driverId).populate('assignedBusId');

        if (!driver || !driver.assignedBusId) {
            throw new Error('No bus assigned to this driver');
        }

        const bus = driver.assignedBusId as any;

        return {
            id: String(bus._id),
            numberPlate: bus.numberPlate,
            status: bus.status,
            currentLat: bus.currentLat,
            currentLng: bus.currentLng,
            lastUpdated: bus.lastUpdated,
        };
    },

    getMyRoute: async (driverId: string) => {
        const driver = await Driver.findById(driverId).populate('assignedBusId');

        if (!driver || !driver.assignedBusId) {
            throw new Error('No bus assigned to this driver');
        }

        const bus = driver.assignedBusId as any;

        if (!bus.routeId) {
            throw new Error('No route assigned to this bus');
        }

        const route = await Route.findOne({
            _id: bus.routeId,
            organizationId: driver.organizationId,
        });

        if (!route) {
            throw new Error('Route not found');
        }

        const stops = await Stop.find({
            organizationId: driver.organizationId,
            routeId: route._id,
        }).sort({ sequenceOrder: 1 });

        return {
            bus: {
                id: String(bus._id),
                numberPlate: bus.numberPlate,
            },
            route: {
                id: String(route._id),
                name: route.name,
                encodedPolyline: route.encodedPolyline,
                totalDistanceMeters: route.totalDistanceMeters,
                estimatedDurationSeconds: route.estimatedDurationSeconds,
                isActive: route.isActive,
            },
            stops: stops.map((stop) => ({
                id: String(stop._id),
                name: stop.name,
                latitude: stop.latitude,
                longitude: stop.longitude,
                sequenceOrder: stop.sequenceOrder,
                radiusMeters: stop.radiusMeters,
            })),
        };
    },

    updateAssignedBus: async (driverId: string, busId: string | null) => {
        const driver = await Driver.findByIdAndUpdate(
            driverId,
            { assignedBusId: busId || null },
            { new: true }
        ).populate('assignedBusId', 'numberPlate status');

        if (!driver) {
            throw new Error('Driver not found');
        }

        const assignedBus = driver.assignedBusId as any;

        return {
            id: String(driver._id),
            name: driver.name,
            memberId: driver.memberId,
            assignedBus: assignedBus
                ? {
                    id: String(assignedBus._id),
                    numberPlate: assignedBus.numberPlate,
                    status: assignedBus.status,
                }
                : null,
        };
    },
};



