import mongoose, { Document, Schema } from 'mongoose';

export interface IRoute extends Document {
    organizationId: mongoose.Types.ObjectId;
    name: string;
    encodedPolyline: string;
    totalDistanceMeters: number;
    estimatedDurationSeconds: number;
    isActive: boolean;
    createdAt: Date;
    updatedAt: Date;
}

const RouteSchema = new Schema<IRoute>(
    {
        organizationId: { type: Schema.Types.ObjectId, ref: 'Organization', required: true, index: true },
        name: { type: String, required: true },
        encodedPolyline: { type: String, required: true },
        totalDistanceMeters: { type: Number },
        estimatedDurationSeconds: { type: Number },
        isActive: { type: Boolean, default: true },
    },
    { timestamps: true }
);

RouteSchema.index({ organizationId: 1, name: 1 }, { unique: true });

export const Route = mongoose.model<IRoute>('Route', RouteSchema);
