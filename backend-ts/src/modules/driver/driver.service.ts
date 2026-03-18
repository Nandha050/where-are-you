import { Driver } from './driver.model';
import { Bus } from '../bus/bus.model';
import { Route } from '../route/route.model';
import { Stop } from '../stop/stop.model';
import {
    deriveBusStatusesFromDocument,
    setBusTripLifecycleFromEvent,
    syncBusDerivedStatuses,
} from '../bus/bus.status.workflow';
import { FLEET_STATUS, TRIP_STATUS } from '../../constants/busStatus';

const formatBusSnapshot = (bus: any) => {
    if (!bus) {
        return null;
    }

    const statuses = deriveBusStatusesFromDocument(bus);

    return {
        id: String(bus._id),
        numberPlate: bus.numberPlate,
        fleetStatus: statuses.fleetStatus,
        tripStatus: statuses.tripStatus,
        trackingStatus: statuses.trackingStatus,
        status: statuses.status,
        currentLat: bus.currentLat,
        currentLng: bus.currentLng,
        lastUpdated: bus.lastUpdated,
    };
};

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
        const driver = await Driver.findById(driverId).populate(
            'assignedBusId',
            'numberPlate status fleetStatus tripStatus trackingStatus currentLat currentLng lastUpdated'
        );

        if (!driver) {
            throw new Error('Driver not found');
        }

        const assignedBus = driver.assignedBusId as any;

        return {
            id: String(driver._id),
            name: driver.name,
            memberId: driver.memberId,
            organizationId: String(driver.organizationId),
            assignedBus: formatBusSnapshot(assignedBus),
        };
    },

    getMyBus: async (driverId: string) => {
        const driver = await Driver.findById(driverId).populate('assignedBusId');

        if (!driver || !driver.assignedBusId) {
            throw new Error('No bus assigned to this driver');
        }

        const bus = driver.assignedBusId as any;

        return formatBusSnapshot(bus);
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

    startMyTracking: async (driverId: string, organizationId: string) => {
        const driver = await Driver.findOne({ _id: driverId, organizationId });

        if (!driver) {
            throw new Error('Driver not found');
        }

        if (!driver.assignedBusId) {
            throw new Error('No bus assigned to this driver');
        }

        const bus = await Bus.findOne({ _id: driver.assignedBusId, organizationId });

        if (!bus) {
            throw new Error('Assigned bus not found');
        }

        const statuses = deriveBusStatusesFromDocument(bus);
        if (statuses.fleetStatus !== FLEET_STATUS.IN_SERVICE) {
            throw new Error(
                `Cannot start trip while fleetStatus is ${statuses.fleetStatus}. Set fleet status to IN_SERVICE first.`
            );
        }

        driver.isTracking = true;
        await driver.save();

        bus.lastUpdated = new Date();
        bus.trackerOnline = true;

        const derived = await syncBusDerivedStatuses(bus, {
            persist: true,
            latestTelemetry: {
                timestamp: bus.lastUpdated,
                speedMps: bus.currentSpeedMps,
            },
        });

        return {
            tracking: {
                driverId: String(driver._id),
                busId: String(bus._id),
                isTracking: driver.isTracking,
                trackingStatus: derived.trackingStatus,
                tripStatus: derived.tripStatus,
                fleetStatus: derived.fleetStatus,
                startedAt: bus.lastUpdated,
            },
        };
    },

    stopMyTracking: async (driverId: string, organizationId: string) => {
        const driver = await Driver.findOne({ _id: driverId, organizationId });

        if (!driver) {
            throw new Error('Driver not found');
        }

        if (!driver.assignedBusId) {
            throw new Error('No bus assigned to this driver');
        }

        const bus = await Bus.findOne({ _id: driver.assignedBusId, organizationId });

        if (!bus) {
            throw new Error('Assigned bus not found');
        }

        driver.isTracking = false;
        await driver.save();

        bus.lastUpdated = new Date();
        bus.trackerOnline = false;

        const statuses = deriveBusStatusesFromDocument(bus);
        if (
            statuses.tripStatus === TRIP_STATUS.ON_TRIP ||
            statuses.tripStatus === TRIP_STATUS.DELAYED
        ) {
            setBusTripLifecycleFromEvent(bus, { type: 'trip_completed', at: bus.lastUpdated });
        }

        const derived = await syncBusDerivedStatuses(bus, {
            persist: true,
            latestTelemetry: {
                timestamp: bus.lastUpdated,
                speedMps: bus.currentSpeedMps,
            },
        });

        return {
            tracking: {
                driverId: String(driver._id),
                busId: String(bus._id),
                isTracking: driver.isTracking,
                trackingStatus: derived.trackingStatus,
                tripStatus: derived.tripStatus,
                fleetStatus: derived.fleetStatus,
                stoppedAt: bus.lastUpdated,
            },
        };
    },

    updateAssignedBus: async (driverId: string, busId: string | null) => {
        const driver = await Driver.findByIdAndUpdate(
            driverId,
            { assignedBusId: busId || null },
            { new: true }
        ).populate(
            'assignedBusId',
            'numberPlate status fleetStatus tripStatus trackingStatus currentLat currentLng lastUpdated'
        );

        if (!driver) {
            throw new Error('Driver not found');
        }

        const assignedBus = driver.assignedBusId as any;

        return {
            id: String(driver._id),
            name: driver.name,
            memberId: driver.memberId,
            assignedBus: formatBusSnapshot(assignedBus),
        };
    },
};



