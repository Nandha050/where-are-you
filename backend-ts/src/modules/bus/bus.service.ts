import { Bus } from './bus.model';
import { Driver } from '../driver/driver.model';
import { Route } from '../route/route.model';
import { CreateBusInput } from './bus.validation';
import {
    FLEET_STATUS,
    LEGACY_BUS_STATUS,
    TRIP_STATUS,
    TRIP_STATUS_VALUES,
    TripStatus,
} from '../../constants/busStatus';
import { TRACKING_STATUS } from '../../constants/trackingStatus';
import {
    applyMaintenanceModeStatus,
    applyRouteAssignmentStatus,
    deriveBusStatusesFromDocument,
    setBusTripLifecycleFromEvent,
    syncBusDerivedStatuses,
    transitionBusTripStatus,
} from './bus.status.workflow';

const getRouteDetails = (routeRef: unknown): { routeId: string | null; routeName: string | null } => {
    if (!routeRef) {
        return { routeId: null, routeName: null };
    }

    const route = routeRef as any;
    const routeId = route._id || route;

    return {
        routeId: routeId ? String(routeId) : null,
        routeName: typeof route.name === 'string' ? route.name : null,
    };
};

const buildBusPayload = (bus: any) => {
    const derivedStatuses = deriveBusStatusesFromDocument(bus);
    const driver = bus.driverId as any;
    const route = getRouteDetails(bus.routeId);

    return {
        id: String(bus._id),
        numberPlate: bus.numberPlate,
        driver: driver
            ? {
                id: String(driver._id || driver),
                name: driver.name || '',
                memberId: driver.memberId || '',
            }
            : null,
        driverId: bus.driverId ? String((bus.driverId as any)._id || bus.driverId) : null,
        routeId: route.routeId,
        routeName: route.routeName,
        fleetStatus: derivedStatuses.fleetStatus,
        tripStatus: derivedStatuses.tripStatus,
        trackingStatus: derivedStatuses.trackingStatus,
        status: derivedStatuses.status,
        currentLat: bus.currentLat,
        currentLng: bus.currentLng,
        currentSpeedMps: bus.currentSpeedMps,
        lastUpdated: bus.lastUpdated,
    };
};

export const busService = {
    createBus: async (organizationId: string, input: CreateBusInput) => {
        const existingBus = await Bus.findOne({
            organizationId,
            numberPlate: input.numberPlate,
        });

        if (existingBus) {
            throw new Error('Bus with this number plate already exists in your organization');
        }

        const bus = await Bus.create({
            organizationId,
            numberPlate: input.numberPlate,
            driverId: (input.driverId || null) as any,
            status: LEGACY_BUS_STATUS.INACTIVE,
            fleetStatus: FLEET_STATUS.OUT_OF_SERVICE,
            tripStatus: TRIP_STATUS.NOT_SCHEDULED,
            trackingStatus: TRACKING_STATUS.NO_SIGNAL,
            maintenanceMode: false,
            trackerOnline: true,
        });

        await syncBusDerivedStatuses(bus, { persist: true });

        return buildBusPayload(bus);
    },

    getBusesByOrganization: async (organizationId: string) => {
        const buses = await Bus.find({ organizationId })
            .populate('driverId', 'name memberId')
            .populate('routeId', 'name');

        return buses.map(buildBusPayload);
    },

    getBusById: async (organizationId: string, busId: string) => {
        const bus = await Bus.findOne({
            _id: busId,
            organizationId,
        })
            .populate('driverId', 'name memberId')
            .populate('routeId', 'name');

        if (!bus) {
            throw new Error('Bus not found');
        }

        return buildBusPayload(bus);
    },

    updateBusDriver: async (organizationId: string, busId: string, memberId: string) => {
        const bus = await Bus.findOne({
            _id: busId,
            organizationId,
        });

        if (!bus) {
            throw new Error('Bus not found');
        }

        // Find driver by memberId
        const driver = await Driver.findOne({
            organizationId,
            memberId: memberId,
        });

        if (!driver) {
            throw new Error(`Driver with memberId '${memberId}' not found`);
        }

        // Remove previous driver from this bus
        if (bus.driverId) {
            await Driver.findByIdAndUpdate(bus.driverId, { assignedBusId: null });
        }

        bus.driverId = driver._id as any;
        await bus.save();

        // Update new driver with assigned bus
        await Driver.findByIdAndUpdate(driver._id, { assignedBusId: busId });

        const payload = buildBusPayload(bus);
        return {
            ...payload,
            driverId: String(driver._id),
            driverMemberId: driver.memberId,
            driverName: driver.name,
        };
    },

    deleteBus: async (organizationId: string, busId: string) => {
        const bus = await Bus.findOneAndDelete({
            _id: busId,
            organizationId,
        });

        if (!bus) {
            throw new Error('Bus not found');
        }

        return { message: 'Bus deleted successfully' };
    },

    updateRouteForBus: async (organizationId: string, busId: string, routeName: string) => {
        const bus = await Bus.findOne({ _id: busId, organizationId });
        if (!bus) {
            throw new Error('Bus not found');
        }

        const route = await Route.findOne({ organizationId, name: routeName });
        if (!route) {
            throw new Error(`Route with name '${routeName}' not found`);
        }

        const currentTripStatus = bus.tripStatus || deriveBusStatusesFromDocument(bus).tripStatus;
        if (
            currentTripStatus === TRIP_STATUS.ON_TRIP ||
            currentTripStatus === TRIP_STATUS.DELAYED
        ) {
            throw new Error(
                'Route change blocked: bus is currently ON_TRIP or DELAYED. End, complete, or cancel the current trip first, then retry route reassignment.'
            );
        }

        bus.routeId = route._id as any;
        applyRouteAssignmentStatus(bus);
        await syncBusDerivedStatuses(bus, { persist: true });

        const payload = buildBusPayload({
            ...bus.toObject(),
            routeId: {
                _id: route._id,
                name: route.name,
            },
        });

        return payload;
    },

    setMaintenanceMode: async (organizationId: string, busId: string, maintenanceMode: boolean) => {
        const bus = await Bus.findOne({ _id: busId, organizationId });
        if (!bus) {
            throw new Error('Bus not found');
        }

        applyMaintenanceModeStatus(bus, maintenanceMode);
        await syncBusDerivedStatuses(bus, { persist: true });
        return buildBusPayload(bus);
    },

    transitionTripStatus: async (
        organizationId: string,
        busId: string,
        nextTripStatus: TripStatus,
        options?: { routeRemoved?: boolean; delayMinutes?: number; eventAt?: Date }
    ) => {
        if (!TRIP_STATUS_VALUES.includes(nextTripStatus)) {
            throw new Error(`Invalid trip status '${nextTripStatus}'`);
        }

        const bus = await Bus.findOne({ _id: busId, organizationId });
        if (!bus) {
            throw new Error('Bus not found');
        }

        transitionBusTripStatus(bus, nextTripStatus, options);
        await syncBusDerivedStatuses(bus, { persist: true });
        return buildBusPayload(bus);
    },

    markTripEvent: async (
        organizationId: string,
        busId: string,
        event:
            | { type: 'trip_started'; at?: Date }
            | { type: 'trip_completed'; at?: Date }
            | { type: 'trip_cancelled'; at?: Date }
            | { type: 'trip_delayed'; at?: Date; delayMinutes: number }
    ) => {
        const bus = await Bus.findOne({ _id: busId, organizationId });
        if (!bus) {
            throw new Error('Bus not found');
        }

        setBusTripLifecycleFromEvent(bus, event);
        await syncBusDerivedStatuses(bus, { persist: true });
        return buildBusPayload(bus);
    },
};
