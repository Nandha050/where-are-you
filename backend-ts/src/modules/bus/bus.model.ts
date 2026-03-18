import mongoose, { Document, Schema } from 'mongoose';
import {
    FLEET_STATUS,
    FLEET_STATUS_VALUES,
    FleetStatus,
    LEGACY_BUS_STATUS,
    LegacyBusStatus,
    TRIP_STATUS,
    TRIP_STATUS_VALUES,
    TripStatus,
} from '../../constants/busStatus';
import {
    TRACKING_STATUS,
    TRACKING_STATUS_VALUES,
    TrackingStatus,
} from '../../constants/trackingStatus';

const TRACKING_STATUS_SCHEMA_VALUES = [
    ...TRACKING_STATUS_VALUES,
    'running',
    'stopped',
    'online',
    'offline',
    'idle',
    'no_signal',
];

export interface IBus extends Document {
    organizationId: mongoose.Types.ObjectId;
    numberPlate: string;
    driverId?: mongoose.Types.ObjectId | null;
    routeId?: mongoose.Types.ObjectId;
    status: LegacyBusStatus;
    fleetStatus: FleetStatus;
    tripStatus: TripStatus;
    currentLat?: number;
    currentLng?: number;
    currentSpeedMps?: number;
    lastUpdated?: Date;
    lastMovementAt?: Date;
    trackingStatus: TrackingStatus;
    maintenanceMode: boolean;
    trackerOnline: boolean;
    tripStartedAt?: Date;
    tripEndedAt?: Date;
    tripCancelledAt?: Date;
    tripDelayMinutes?: number;
}

const BusSchema = new Schema<IBus>({
    organizationId: { type: Schema.Types.ObjectId, ref: 'Organization', required: true },
    numberPlate: { type: String, required: true },
    driverId: { type: Schema.Types.ObjectId, ref: 'Driver' },
    routeId: { type: Schema.Types.ObjectId, ref: 'Route' },
    status: { type: String, enum: Object.values(LEGACY_BUS_STATUS), default: LEGACY_BUS_STATUS.ACTIVE },
    fleetStatus: { type: String, enum: FLEET_STATUS_VALUES, default: FLEET_STATUS.IN_SERVICE },
    tripStatus: { type: String, enum: TRIP_STATUS_VALUES, default: TRIP_STATUS.NOT_SCHEDULED },
    currentLat: { type: Number },
    currentLng: { type: Number },
    currentSpeedMps: { type: Number },
    lastUpdated: { type: Date },
    lastMovementAt: { type: Date },
    trackingStatus: {
        type: String,
        enum: TRACKING_STATUS_SCHEMA_VALUES,
        default: TRACKING_STATUS.NO_SIGNAL,
    },
    maintenanceMode: { type: Boolean, default: false },
    trackerOnline: { type: Boolean, default: true },
    tripStartedAt: { type: Date },
    tripEndedAt: { type: Date },
    tripCancelledAt: { type: Date },
    tripDelayMinutes: { type: Number },
});

BusSchema.index({ organizationId: 1, numberPlate: 1 }, { unique: true });

export const Bus = mongoose.model<IBus>('Bus', BusSchema);
