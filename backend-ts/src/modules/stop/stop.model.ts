import mongoose, { Document, Schema } from 'mongoose';

export interface IStop extends Document {
    organizationId: mongoose.Types.ObjectId;
    routeId: mongoose.Types.ObjectId;
    name: string;
    latitude: number;
    longitude: number;
    sequenceOrder: number;
}

const StopSchema = new Schema<IStop>({
    organizationId: { type: Schema.Types.ObjectId, ref: 'Organization', required: true },
    routeId: { type: Schema.Types.ObjectId, ref: 'Route', required: true },
    name: { type: String, required: true },
    latitude: { type: Number, required: true },
    longitude: { type: Number, required: true },
    sequenceOrder: { type: Number, required: true },
});

export const Stop = mongoose.model<IStop>('Stop', StopSchema);
