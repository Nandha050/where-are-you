import mongoose, { Document, Schema } from 'mongoose';
import { NOTIFICATION_TYPES, NotificationType } from '../../constants/notificationTypes';

export interface INotification extends Document {
	organizationId: mongoose.Types.ObjectId;
	userId: mongoose.Types.ObjectId;
	busId?: mongoose.Types.ObjectId | null;
	stopId?: mongoose.Types.ObjectId | null;
	type: NotificationType;
	title: string;
	message: string;
	payload?: Record<string, unknown>;
	isRead: boolean;
	createdAt: Date;
	updatedAt: Date;
}

const NotificationSchema = new Schema<INotification>(
	{
		organizationId: { type: Schema.Types.ObjectId, ref: 'Organization', required: true, index: true },
		userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
		busId: { type: Schema.Types.ObjectId, ref: 'Bus', default: null },
		stopId: { type: Schema.Types.ObjectId, ref: 'Stop', default: null },
		type: {
			type: String,
			enum: Object.values(NOTIFICATION_TYPES),
			required: true,
		},
		title: { type: String, required: true },
		message: { type: String, required: true },
		payload: { type: Schema.Types.Mixed, default: {} },
		isRead: { type: Boolean, default: false },
	},
	{ timestamps: true }
);

NotificationSchema.index({ userId: 1, isRead: 1, createdAt: -1 });

export const Notification = mongoose.model<INotification>('Notification', NotificationSchema);

