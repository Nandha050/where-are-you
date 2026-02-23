import mongoose, { Document, Schema } from 'mongoose';

export interface IBusSubscription extends Document {
    organizationId: mongoose.Types.ObjectId;
    userId: mongoose.Types.ObjectId;
    busId: mongoose.Types.ObjectId;
    stopId: mongoose.Types.ObjectId;
}

const BusSubscriptionSchema = new Schema<IBusSubscription>({
    organizationId: { type: Schema.Types.ObjectId, ref: 'Organization', required: true },
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    busId: { type: Schema.Types.ObjectId, ref: 'Bus', required: true },
    stopId: { type: Schema.Types.ObjectId, ref: 'Stop', required: true },
});

BusSubscriptionSchema.index({ userId: 1, busId: 1 }, { unique: true });

export const BusSubscription = mongoose.model<IBusSubscription>('BusSubscription', BusSubscriptionSchema);
