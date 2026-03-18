import { Driver } from './driver.model';
import { Bus } from '../bus/bus.model';
import { Route } from '../route/route.model';
import { Stop } from '../stop/stop.model';
import {
    applyRouteAssignmentStatus,
    deriveBusStatusesFromDocument,
    setBusTripLifecycleFromEvent,
    syncBusDerivedStatuses,
} from '../bus/bus.status.workflow';
import { FLEET_STATUS, TRIP_STATUS } from '../../constants/busStatus';
import { buildEtaSnapshot } from '../../utils/eta';
import { calculateDistanceMeters } from '../../utils/calculateDistance';

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

const buildNoBusAssignedMessage = (driver: { memberId?: string }) =>
    `No bus assigned to this driver. Ask admin to assign a bus to memberId '${driver.memberId || 'unknown'}'.`;

const resolveAssignedBusForDriver = async (driver: any) => {
    if (!driver) {
        return null;
    }

    if (driver.assignedBusId) {
        const assignedBus = await Bus.findOne({
            _id: driver.assignedBusId,
            organizationId: driver.organizationId,
        });

        if (assignedBus) {
            if (!assignedBus.driverId || String(assignedBus.driverId) !== String(driver._id)) {
                assignedBus.driverId = driver._id;
                await assignedBus.save();
            }

            return assignedBus;
        }
    }

    const busByDriver = await Bus.findOne({
        organizationId: driver.organizationId,
        driverId: driver._id,
    });

    if (!busByDriver) {
        return null;
    }

    if (!driver.assignedBusId || String(driver.assignedBusId) !== String(busByDriver._id)) {
        driver.assignedBusId = busByDriver._id;
        await driver.save();
    }

    return busByDriver;
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
        const driver = await Driver.findById(driverId);

        if (!driver) {
            throw new Error('Driver not found');
        }

        const assignedBus = await resolveAssignedBusForDriver(driver);

        return {
            id: String(driver._id),
            name: driver.name,
            memberId: driver.memberId,
            organizationId: String(driver.organizationId),
            assignedBus: formatBusSnapshot(assignedBus),
        };
    },

    getMyBus: async (driverId: string) => {
        const driver = await Driver.findById(driverId);

        if (!driver) {
            throw new Error('Driver not found');
        }

        const bus = await resolveAssignedBusForDriver(driver);

        if (!bus) {
            throw new Error(buildNoBusAssignedMessage(driver));
        }

        return formatBusSnapshot(bus);
    },

    getMyRoute: async (driverId: string) => {
        const driver = await Driver.findById(driverId);

        if (!driver) {
            throw new Error('Driver not found');
        }

        const bus = await resolveAssignedBusForDriver(driver);

        if (!bus) {
            throw new Error(buildNoBusAssignedMessage(driver));
        }

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

        const normalizedStops = stops.map((stop) => ({
            id: String(stop._id),
            name: stop.name,
            latitude: stop.latitude,
            longitude: stop.longitude,
            sequenceOrder: stop.sequenceOrder,
            radiusMeters: stop.radiusMeters,
        }));

        const START_END_MERGE_RADIUS_METERS = 120;
        const hasStartStop = normalizedStops.some(
            (stop) =>
                calculateDistanceMeters(stop.latitude, stop.longitude, route.startLat, route.startLng) <=
                START_END_MERGE_RADIUS_METERS
        );
        const hasEndStop = normalizedStops.some(
            (stop) =>
                calculateDistanceMeters(stop.latitude, stop.longitude, route.endLat, route.endLng) <=
                START_END_MERGE_RADIUS_METERS
        );

        const firstSequence = normalizedStops.length > 0 ? normalizedStops[0].sequenceOrder : 1;
        const lastSequence =
            normalizedStops.length > 0
                ? normalizedStops[normalizedStops.length - 1].sequenceOrder
                : firstSequence + 1;

        const stopsForEta = [...normalizedStops];

        if (!hasStartStop) {
            stopsForEta.push({
                id: `start-${String(route._id)}`,
                name: route.startName || 'Start',
                latitude: route.startLat,
                longitude: route.startLng,
                sequenceOrder: firstSequence - 1,
                radiusMeters: 100,
            });
        }

        if (!hasEndStop) {
            stopsForEta.push({
                id: `end-${String(route._id)}`,
                name: route.endName || 'Destination',
                latitude: route.endLat,
                longitude: route.endLng,
                sequenceOrder: lastSequence + 1,
                radiusMeters: 100,
            });
        }

        const hasLiveCoordinates =
            typeof bus.currentLat === 'number' &&
            typeof bus.currentLng === 'number' &&
            Number.isFinite(bus.currentLat) &&
            Number.isFinite(bus.currentLng) &&
            (bus.currentLat !== 0 || bus.currentLng !== 0);

        const eta = buildEtaSnapshot({
            current: {
                latitude: hasLiveCoordinates ? bus.currentLat! : route.startLat,
                longitude: hasLiveCoordinates ? bus.currentLng! : route.startLng,
            },
            route: {
                totalDistanceMeters: route.totalDistanceMeters,
                estimatedDurationSeconds: route.estimatedDurationSeconds,
                endLat: route.endLat,
                endLng: route.endLng,
                polyline: route.polyline || route.encodedPolyline,
            },
            stops: stopsForEta,
        });

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
                totalDistanceText: eta.routeDistanceText,
                estimatedDurationSeconds: route.estimatedDurationSeconds,
                estimatedDurationText: eta.routeDurationText,
                etaToDestinationSeconds: eta.etaToDestinationSeconds,
                etaToDestinationText: eta.etaToDestinationText,
                distanceToDestinationMeters: eta.distanceToDestinationMeters,
                distanceToDestinationText: eta.distanceToDestinationText,
                averageSpeedKmph: eta.averageSpeedKmph,
                isActive: route.isActive,
            },
            stops: eta.stopsWithEta,
        };
    },

    startMyTracking: async (driverId: string, organizationId: string) => {
        const driver = await Driver.findOne({ _id: driverId, organizationId });

        if (!driver) {
            throw new Error('Driver not found');
        }

        const bus = await resolveAssignedBusForDriver(driver);

        if (!bus) {
            throw new Error(buildNoBusAssignedMessage(driver));
        }

        const statuses = deriveBusStatusesFromDocument(bus);
        if (statuses.fleetStatus !== FLEET_STATUS.IN_SERVICE) {
            throw new Error(
                `Cannot start trip while fleetStatus is ${statuses.fleetStatus}. Set fleet status to IN_SERVICE first.`
            );
        }

        if (!bus.routeId) {
            throw new Error('Cannot start trip because no route is assigned to this bus. Assign a route first.');
        }

        driver.isTracking = true;
        await driver.save();

        bus.lastUpdated = new Date();

        const latestTripStatus = bus.tripStatus || deriveBusStatusesFromDocument(bus).tripStatus;
        if (bus.trackerOnline) {
            if (
                latestTripStatus !== TRIP_STATUS.ON_TRIP &&
                latestTripStatus !== TRIP_STATUS.DELAYED
            ) {
                if (latestTripStatus !== TRIP_STATUS.TRIP_NOT_STARTED) {
                    applyRouteAssignmentStatus(bus);
                }

                setBusTripLifecycleFromEvent(bus, { type: 'trip_started', at: bus.lastUpdated });
            }
        } else {
            // Tracking is enabled, but ON_TRIP should only happen after live socket connection.
            applyRouteAssignmentStatus(bus);
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
                startedAt: bus.lastUpdated,
            },
        };
    },

    stopMyTracking: async (driverId: string, organizationId: string) => {
        const driver = await Driver.findOne({ _id: driverId, organizationId });

        if (!driver) {
            throw new Error('Driver not found');
        }

        const bus = await resolveAssignedBusForDriver(driver);

        if (!bus) {
            throw new Error(buildNoBusAssignedMessage(driver));
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

        // When tracking is off (or socket disconnected), keep route-assigned buses at TRIP_NOT_STARTED.
        applyRouteAssignmentStatus(bus);

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

    syncTripStatusWithSocketConnection: async (
        driverId: string,
        organizationId: string,
        isConnected: boolean
    ) => {
        const driver = await Driver.findOne({ _id: driverId, organizationId });
        if (!driver) {
            return null;
        }

        const bus = await resolveAssignedBusForDriver(driver);
        if (!bus) {
            return null;
        }

        bus.lastUpdated = new Date();
        bus.trackerOnline = isConnected;

        const statuses = deriveBusStatusesFromDocument(bus);

        if (driver.isTracking) {
            if (isConnected) {
                if (
                    statuses.fleetStatus === FLEET_STATUS.IN_SERVICE &&
                    bus.routeId &&
                    statuses.tripStatus !== TRIP_STATUS.ON_TRIP &&
                    statuses.tripStatus !== TRIP_STATUS.DELAYED
                ) {
                    if (statuses.tripStatus !== TRIP_STATUS.TRIP_NOT_STARTED) {
                        applyRouteAssignmentStatus(bus);
                    }

                    setBusTripLifecycleFromEvent(bus, { type: 'trip_started', at: bus.lastUpdated });
                }
            } else {
                if (
                    statuses.tripStatus === TRIP_STATUS.ON_TRIP ||
                    statuses.tripStatus === TRIP_STATUS.DELAYED
                ) {
                    setBusTripLifecycleFromEvent(bus, { type: 'trip_completed', at: bus.lastUpdated });
                }

                applyRouteAssignmentStatus(bus);
            }
        }

        const derived = await syncBusDerivedStatuses(bus, {
            persist: true,
            latestTelemetry: {
                timestamp: bus.lastUpdated,
                speedMps: bus.currentSpeedMps,
            },
        });

        return {
            busId: String(bus._id),
            isConnected,
            isTracking: driver.isTracking,
            tripStatus: derived.tripStatus,
            trackingStatus: derived.trackingStatus,
        };
    },
};



