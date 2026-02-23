import { Bus } from './bus.model';
import { Driver } from '../driver/driver.model';
import { Route } from '../route/route.model';
import { CreateBusInput } from './bus.validation';

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
            status: 'inactive',
            currentLat: 0,
            currentLng: 0,
            lastUpdated: new Date(),
        });

        return {
            id: String(bus._id),
            numberPlate: bus.numberPlate,
            driverId: bus.driverId ? String(bus.driverId) : null,
            status: bus.status,
        };
    },

    getBusesByOrganization: async (organizationId: string) => {
        const buses = await Bus.find({ organizationId }).populate('driverId', 'name employeeId');

        return buses.map((bus) => {
            const driverId = bus.driverId as any;
            return {
                id: String(bus._id),
                numberPlate: bus.numberPlate,
                driver: driverId
                    ? {
                        id: String(driverId._id || driverId),
                        name: driverId.name || '',
                        employeeId: driverId.employeeId || '',
                    }
                    : null,
                status: bus.status,
                currentLat: bus.currentLat,
                currentLng: bus.currentLng,
                lastUpdated: bus.lastUpdated,
            };
        });
    },

    getBusById: async (organizationId: string, busId: string) => {
        const bus = await Bus.findOne({
            _id: busId,
            organizationId,
        }).populate('driverId', 'name employeeId');

        if (!bus) {
            throw new Error('Bus not found');
        }

        const driverId = bus.driverId as any;
        return {
            id: String(bus._id),
            numberPlate: bus.numberPlate,
            driver: driverId
                ? {
                    id: String(driverId._id || driverId),
                    name: driverId.name || '',
                    employeeId: driverId.employeeId || '',
                }
                : null,
            status: bus.status,
            currentLat: bus.currentLat,
            currentLng: bus.currentLng,
            lastUpdated: bus.lastUpdated,
        };
    },

    updateBusDriver: async (organizationId: string, busId: string, driverId: string) => {
        const bus = await Bus.findOne({
            _id: busId,
            organizationId,
        });

        if (!bus) {
            throw new Error('Bus not found');
        }

        // Remove previous driver from this bus
        if (bus.driverId) {
            await Driver.findByIdAndUpdate(bus.driverId, { assignedBusId: null });
        }

        bus.driverId = (driverId || null) as any;
        await bus.save();

        // Update new driver with assigned bus
        if (driverId) {
            await Driver.findByIdAndUpdate(driverId, { assignedBusId: busId });
        }

        return {
            id: String(bus._id),
            numberPlate: bus.numberPlate,
            driverId: bus.driverId ? String(bus.driverId) : null,
            status: bus.status,
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

    updateRouteForBus: async (organizationId: string, busId: string, routeId: string) => {
        const bus = await Bus.findOne({ _id: busId, organizationId });
        if (!bus) {
            throw new Error('Bus not found');
        }

        const route = await Route.findOne({ _id: routeId, organizationId });
        if (!route) {
            throw new Error('Route not found');
        }

        bus.routeId = routeId as any;
        await bus.save();

        return {
            id: String(bus._id),
            numberPlate: bus.numberPlate,
            routeId: String(bus.routeId),
            status: bus.status,
            trackingStatus: bus.trackingStatus,
        };
    },
};
