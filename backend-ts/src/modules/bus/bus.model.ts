import mongoose, { Document, Schema } from 'mongoose';
import {
    BUS_LIFECYCLE_STATUS,
    BUS_LIFECYCLE_STATUS_VALUES,
    BusLifecycleStatus,
} from '../../constants/busLifecycle';

export interface IBus extends Document {
    organizationId: mongoose.Types.ObjectId;
    numberPlate: string;
    driverId?: mongoose.Types.ObjectId | null;
    routeId?: mongoose.Types.ObjectId;
    status: BusLifecycleStatus;
    currentLat?: number;
    currentLng?: number;
    currentSpeedMps?: number;
    lastUpdated?: Date;
}

const BusSchema = new Schema<IBus>({
    organizationId: { type: Schema.Types.ObjectId, ref: 'Organization', required: true },
    numberPlate: { type: String, required: true },
    driverId: { type: Schema.Types.ObjectId, ref: 'Driver' },
    routeId: { type: Schema.Types.ObjectId, ref: 'Route' },
    status: { type: String, enum: BUS_LIFECYCLE_STATUS_VALUES, default: BUS_LIFECYCLE_STATUS.ACTIVE },
    currentLat: { type: Number },
    currentLng: { type: Number },
    currentSpeedMps: { type: Number },
    lastUpdated: { type: Date },
});

BusSchema.index({ organizationId: 1, numberPlate: 1 }, { unique: true });

export const Bus = mongoose.model<IBus>('Bus', BusSchema);
