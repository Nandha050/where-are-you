import mongoose, { Document, Schema } from 'mongoose';

export interface IStop extends Document {
    organizationId: mongoose.Types.ObjectId;
    routeId: mongoose.Types.ObjectId;
    name: string;
    latitude: number;
    longitude: number;
    sequenceOrder: number;
    radiusMeters: number;
    createdAt: Date;
    updatedAt: Date;
}

const StopSchema = new Schema<IStop>(
    {
        organizationId: { type: Schema.Types.ObjectId, ref: 'Organization', required: true, index: true },
        routeId: { type: Schema.Types.ObjectId, ref: 'Route', required: true, index: true },
        name: { type: String, required: true },
        latitude: { type: Number, required: true },
        longitude: { type: Number, required: true },
        sequenceOrder: { type: Number, required: true },
        radiusMeters: { type: Number, default: 100 },
    },
    { timestamps: true }
);

StopSchema.index({ organizationId: 1, routeId: 1, sequenceOrder: 1 }, { unique: true });

export const Stop = mongoose.model<IStop>('Stop', StopSchema);
