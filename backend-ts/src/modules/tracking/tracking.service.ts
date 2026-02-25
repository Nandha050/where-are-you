import { Bus } from '../bus/bus.model';
import { Driver } from '../driver/driver.model';
import { LocationLog } from '../locationLog/locationLog.model';
import { TRACKING_EVENTS } from './tracking.events';
import { getBusRoom } from '../../websocket/socket.rooms';
import { getIO } from '../../websocket/socket.server';

const validateCoordinates = (latitude: number, longitude: number): void => {
	if (!Number.isFinite(latitude) || latitude < -90 || latitude > 90) {
		throw new Error('latitude must be between -90 and 90');
	}

	if (!Number.isFinite(longitude) || longitude < -180 || longitude > 180) {
		throw new Error('longitude must be between -180 and 180');
	}
};

export const trackingService = {
	updateBusLocation: async (busId: string, latitude: number, longitude: number) => {
		validateCoordinates(latitude, longitude);

		const now = new Date();

		const bus = await Bus.findByIdAndUpdate(
			busId,
			{
				currentLat: latitude,
				currentLng: longitude,
				lastUpdated: now,
				trackingStatus: 'running',
			},
			{ new: true }
		);

		if (!bus) {
			throw new Error('Bus not found');
		}

		await LocationLog.create({
			organizationId: bus.organizationId,
			busId: bus._id,
			latitude,
			longitude,
			recordedAt: now,
		});

		try {
			const io = getIO();
			io.to(getBusRoom(String(bus._id))).emit(TRACKING_EVENTS.BUS_LOCATION_UPDATE, {
				busId: String(bus._id),
				latitude,
				longitude,
				recordedAt: now.toISOString(),
			});
		} catch {
			// Socket server may not be initialized in some non-server contexts
		}

		return {
			busId: String(bus._id),
			latitude: bus.currentLat,
			longitude: bus.currentLng,
			recordedAt: now,
		};
	},

	updateMyBusLocation: async (
		driverId: string,
		organizationId: string,
		latitude: number,
		longitude: number
	) => {
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

		return trackingService.updateBusLocation(String(bus._id), latitude, longitude);
	},
};
