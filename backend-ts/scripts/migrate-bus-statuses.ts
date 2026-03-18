import mongoose from 'mongoose';
import { connectDB } from '../src/config/db.config';
import { Bus } from '../src/modules/bus/bus.model';
import {
    deriveBusStatuses,
    deriveDefaultTripStatus,
    deriveTrackingStatus,
    mapFleetStatusToLegacyStatus,
    deriveFleetStatus,
} from '../src/modules/bus/bus.status.service';
import { logger } from '../src/utils/logger';
import { TRACKING_STATUS } from '../src/constants/trackingStatus';

const args = process.argv.slice(2);
const dryRun = args.includes('--dry-run');

const run = async (): Promise<void> => {
    await connectDB();

    const buses = await Bus.find({});

    let updated = 0;

    for (const bus of buses) {
        const previous = {
            status: bus.status,
            fleetStatus: bus.fleetStatus,
            tripStatus: bus.tripStatus,
            trackingStatus: bus.trackingStatus,
        };

        const fleetStatus = deriveFleetStatus(bus);

        // Backfill defaults for legacy records that have no canonical trip status.
        const defaultTripStatus = deriveDefaultTripStatus(bus);

        // Backfill NO_SIGNAL for buses without telemetry timestamp/coordinates.
        const defaultTrackingStatus = deriveTrackingStatus(bus, {
            latitude: bus.currentLat,
            longitude: bus.currentLng,
            timestamp: bus.lastUpdated,
            speedMps: bus.currentSpeedMps,
            explicitlyOffline: bus.trackerOnline === false,
        });

        const derived = deriveBusStatuses(
            {
                ...bus.toObject(),
                fleetStatus,
                tripStatus: bus.tripStatus || defaultTripStatus,
                trackingStatus: bus.trackingStatus || defaultTrackingStatus,
            },
            {
                routeId: bus.routeId,
                isAssigned: Boolean(bus.routeId),
            },
            {
                latitude: bus.currentLat,
                longitude: bus.currentLng,
                timestamp: bus.lastUpdated,
                speedMps: bus.currentSpeedMps,
                explicitlyOffline: bus.trackerOnline === false,
            },
            {
                isAssigned: Boolean(bus.routeId),
                startedAt: bus.tripStartedAt,
                endedAt: bus.tripEndedAt,
                cancelledAt: bus.tripCancelledAt,
                delayMinutes: bus.tripDelayMinutes,
                isActive: bus.tripStatus === 'ON_TRIP' || bus.tripStatus === 'DELAYED',
                isCompleted: bus.tripStatus === 'COMPLETED',
                isCancelled: bus.tripStatus === 'CANCELLED',
            }
        );

        const nextValues = {
            status: mapFleetStatusToLegacyStatus(derived.fleetStatus),
            fleetStatus: derived.fleetStatus,
            tripStatus: bus.tripStatus || defaultTripStatus,
            trackingStatus:
                derived.trackingStatus ||
                (bus.lastUpdated ? derived.trackingStatus : TRACKING_STATUS.NO_SIGNAL),
        };

        const changed =
            previous.status !== nextValues.status ||
            previous.fleetStatus !== nextValues.fleetStatus ||
            previous.tripStatus !== nextValues.tripStatus ||
            previous.trackingStatus !== nextValues.trackingStatus;

        if (!changed) {
            continue;
        }

        updated += 1;

        logger.info(
            `[Bus ${String(bus._id)}] ${JSON.stringify(previous)} -> ${JSON.stringify(nextValues)}`
        );

        if (!dryRun) {
            bus.status = nextValues.status;
            bus.fleetStatus = nextValues.fleetStatus;
            bus.tripStatus = nextValues.tripStatus;
            bus.trackingStatus = nextValues.trackingStatus;
            await bus.save();
        }
    }

    logger.info(
        `Bus status migration completed. ${dryRun ? 'Dry run only.' : 'Saved changes.'} Updated buses: ${updated}.`
    );

    await mongoose.disconnect();
};

run().catch(async (error) => {
    logger.error('Bus status migration failed', error);
    await mongoose.disconnect();
    process.exit(1);
});
