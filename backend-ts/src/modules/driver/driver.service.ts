import { Driver } from './driver.model';
import { Bus } from '../bus/bus.model';

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



