import mongoose, { Document, Schema } from 'mongoose';
import { TRIP_STATUS, TRIP_STATUS_VALUES, TripStatus } from '../../constants/tripStatus';

interface TripLocation {
    lat: number;
    lng: number;
}

export interface ITrip extends Document {
    organizationId: mongoose.Types.ObjectId;
    driverId: mongoose.Types.ObjectId;
    busId: mongoose.Types.ObjectId;
    routeId: mongoose.Types.ObjectId;
    status: TripStatus;
    startedAt?: Date;
    endedAt?: Date;
    currentLocation?: TripLocation;
    createdAt: Date;
    updatedAt: Date;
}

const TripLocationSchema = new Schema<TripLocation>(
    {
        lat: { type: Number, required: true },
        lng: { type: Number, required: true },
    },
    { _id: false }
);

const TripSchema = new Schema<ITrip>(
    {
        organizationId: { type: Schema.Types.ObjectId, ref: 'Organization', required: true, index: true },
        driverId: { type: Schema.Types.ObjectId, ref: 'Driver', required: true, index: true },
        busId: { type: Schema.Types.ObjectId, ref: 'Bus', required: true, index: true },
        routeId: { type: Schema.Types.ObjectId, ref: 'Route', required: true, index: true },
        status: { type: String, enum: TRIP_STATUS_VALUES, default: TRIP_STATUS.PENDING, index: true },
        startedAt: { type: Date },
        endedAt: { type: Date },
        currentLocation: { type: TripLocationSchema, required: false },
    },
    { timestamps: true }
);

TripSchema.index({ organizationId: 1, driverId: 1, createdAt: -1 });
TripSchema.index({ organizationId: 1, busId: 1, createdAt: -1 });

export const Trip = mongoose.model<ITrip>('Trip', TripSchema);
