import { Router } from 'express';
import { trackingController } from './tracking.controller';
import { requireAuth } from '../../middleware/auth.middleware';
import { requireRole } from '../../middleware/role.middleware';
import { ROLES } from '../../constants/roles';

export const trackingRouter = Router();

trackingRouter.post('/me/location', requireAuth, requireRole(ROLES.DRIVER), trackingController.updateMyLocation);
