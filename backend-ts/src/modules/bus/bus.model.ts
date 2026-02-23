import mongoose, { Document, Schema } from 'mongoose';

export interface IBus extends Document {
    organizationId: mongoose.Types.ObjectId;
    numberPlate: string;
    driverId?: mongoose.Types.ObjectId | null;
    routeId?: mongoose.Types.ObjectId;
    status: 'active' | 'inactive';
    currentLat: number;
    currentLng: number;
    lastUpdated: Date;
    trackingStatus: 'running' | 'stopped';
}

const BusSchema = new Schema<IBus>({
    organizationId: { type: Schema.Types.ObjectId, ref: 'Organization', required: true },
    numberPlate: { type: String, required: true },
    driverId: { type: Schema.Types.ObjectId, ref: 'Driver' },
    routeId: { type: Schema.Types.ObjectId, ref: 'Route' },
    status: { type: String, enum: ['active', 'inactive'], default: 'active' },
    currentLat: { type: Number },
    currentLng: { type: Number },
    lastUpdated: { type: Date },
    trackingStatus: { type: String, enum: ['running', 'stopped'], default: 'stopped' },
});

BusSchema.index({ organizationId: 1, numberPlate: 1 }, { unique: true });

export const Bus = mongoose.model<IBus>('Bus', BusSchema);
