import mongoose, { Document, Schema } from 'mongoose';

export interface IUser extends Document {
    organizationId: mongoose.Types.ObjectId;
    name: string;
    phone: string;
    passwordHash: string;
    fcmToken: string;
    createdAt: Date;
}

const UserSchema = new Schema<IUser>(
    {
        organizationId: { type: Schema.Types.ObjectId, ref: 'Organization', required: true },
        name: { type: String, required: true },
        phone: { type: String, required: true },
        passwordHash: { type: String, required: true },
        fcmToken: { type: String },
    },
    { timestamps: { createdAt: true, updatedAt: false } }
);

UserSchema.index({ organizationId: 1, phone: 1 }, { unique: true });

export const User = mongoose.model<IUser>('User', UserSchema);
