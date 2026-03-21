import mongoose, { Document, Schema } from 'mongoose';

export interface IDriver extends Document {
    organizationId: mongoose.Types.ObjectId;
    name: string;
    memberId: string;    // unique per org, e.g. D2002
    email?: string;
    phone?: string;
    passwordHash: string;
    assignedBusId: mongoose.Types.ObjectId;
    isTracking: boolean;
    createdAt: Date;
}

const DriverSchema = new Schema<IDriver>(
    {
        organizationId: { type: Schema.Types.ObjectId, ref: 'Organization', required: true },
        name: { type: String, required: true },
        memberId: { type: String, required: true },
        email: { type: String, trim: true, lowercase: true },
        phone: { type: String, trim: true },
        passwordHash: { type: String, required: true },
        assignedBusId: { type: Schema.Types.ObjectId, ref: 'Bus' },
        isTracking: { type: Boolean, default: false },
    },
    { timestamps: { createdAt: true, updatedAt: false } }
);

DriverSchema.index({ organizationId: 1, memberId: 1 }, { unique: true });
DriverSchema.index({ organizationId: 1, email: 1 }, { unique: true, sparse: true });
DriverSchema.index({ organizationId: 1, phone: 1 }, { unique: true, sparse: true });

export const Driver = mongoose.model<IDriver>('Driver', DriverSchema);
