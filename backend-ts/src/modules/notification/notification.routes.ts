import { Router } from 'express';
import { requireAuth } from '../../middleware/auth.middleware';
import { requireRole } from '../../middleware/role.middleware';
import { ROLES } from '../../constants/roles';
import { notificationController } from './notification.controller';

export const notificationRouter = Router();

notificationRouter.use(requireAuth, requireRole(ROLES.USER));

notificationRouter.get('/', notificationController.getMyNotifications);
notificationRouter.patch('/:notificationId/read', notificationController.markMyNotificationAsRead);

