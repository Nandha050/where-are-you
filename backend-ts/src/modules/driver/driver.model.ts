import mongoose, { Document, Schema } from 'mongoose';

export interface IDriver extends Document {
    organizationId: mongoose.Types.ObjectId;
    name: string;
    employeeId: string;    // unique per org, e.g. EMP-001
    passwordHash: string;
    assignedBusId: mongoose.Types.ObjectId;
    isTracking: boolean;
    createdAt: Date;
}

const DriverSchema = new Schema<IDriver>(
    {
        organizationId: { type: Schema.Types.ObjectId, ref: 'Organization', required: true },
        name: { type: String, required: true },
        employeeId: { type: String, required: true },
        passwordHash: { type: String, required: true },
        assignedBusId: { type: Schema.Types.ObjectId, ref: 'Bus' },
        isTracking: { type: Boolean, default: false },
    },
    { timestamps: { createdAt: true, updatedAt: false } }
);

DriverSchema.index({ organizationId: 1, employeeId: 1 }, { unique: true });

export const Driver = mongoose.model<IDriver>('Driver', DriverSchema);
