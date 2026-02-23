import mongoose, { Document, Schema } from 'mongoose';

export interface IRoute extends Document {
    organizationId: mongoose.Types.ObjectId;
    name: string;
    polyline: string;
    estimatedTimeMinutes: number;
}

const RouteSchema = new Schema<IRoute>({
    organizationId: { type: Schema.Types.ObjectId, ref: 'Organization', required: true },
    name: { type: String, required: true },
    polyline: { type: String },
    estimatedTimeMinutes: { type: Number },
});

export const Route = mongoose.model<IRoute>('Route', RouteSchema);
