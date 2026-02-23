import mongoose, { Document, Schema } from 'mongoose';

export interface IAdmin extends Document {
    organizationId: mongoose.Types.ObjectId;
    name: string;
    email: string;
    passwordHash: string;
    createdAt: Date;
}

const AdminSchema = new Schema<IAdmin>(
    {
        organizationId: { type: Schema.Types.ObjectId, ref: 'Organization', required: true },
        name: { type: String, required: true },
        email: { type: String, required: true, unique: true },
        passwordHash: { type: String, required: true },
    },
    { timestamps: { createdAt: true, updatedAt: false } }
);

export const Admin = mongoose.model<IAdmin>('Admin', AdminSchema);
