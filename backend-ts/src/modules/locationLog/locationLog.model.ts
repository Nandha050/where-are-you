import mongoose, { Document, Schema } from 'mongoose';

export interface ILocationLog extends Document {
    organizationId: mongoose.Types.ObjectId;
    busId: mongoose.Types.ObjectId;
    latitude: number;
    longitude: number;
    recordedAt: Date;
}

const LocationLogSchema = new Schema<ILocationLog>({
    organizationId: { type: Schema.Types.ObjectId, ref: 'Organization', required: true },
    busId: { type: Schema.Types.ObjectId, ref: 'Bus', required: true },
    latitude: { type: Number, required: true },
    longitude: { type: Number, required: true },
    recordedAt: { type: Date, default: Date.now },
});

export const LocationLog = mongoose.model<ILocationLog>('LocationLog', LocationLogSchema);
