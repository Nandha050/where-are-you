import { Router } from 'express';
import { requireAuth } from '../../middleware/auth.middleware';
import { requireRole } from '../../middleware/role.middleware';
import { ROLES } from '../../constants/roles';
import { userAppController } from './user.app.controller';

export const userAppRouter = Router();

userAppRouter.use(requireAuth, requireRole(ROLES.USER));

userAppRouter.get('/buses/search', userAppController.searchBuses);
userAppRouter.get('/buses/:busId/live', userAppController.getLiveBus);

userAppRouter.post('/subscriptions', userAppController.subscribeBus);
userAppRouter.get('/subscriptions', userAppController.getMySubscriptions);
userAppRouter.delete('/subscriptions/:subscriptionId', userAppController.unsubscribeBus);

userAppRouter.patch('/profile/fcm-token', userAppController.updateMyFcmToken);
