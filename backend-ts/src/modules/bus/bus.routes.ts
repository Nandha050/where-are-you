import { Router } from 'express';
import { requireAuth } from '../../middleware/auth.middleware';
import { requireRole } from '../../middleware/role.middleware';
import { ROLES } from '../../constants/roles';
import { busController } from './bus.controller';

export const busRouter = Router();

// Admin routes
busRouter.post('/', requireAuth, requireRole(ROLES.ADMIN), busController.createBus);
busRouter.get('/', requireAuth, requireRole(ROLES.ADMIN), busController.getBuses);
busRouter.get('/:busId', requireAuth, requireRole(ROLES.ADMIN), busController.getBusById);
busRouter.put('/:busId/driver', requireAuth, requireRole(ROLES.ADMIN), busController.updateBusDriver);
busRouter.delete('/:busId', requireAuth, requireRole(ROLES.ADMIN), busController.deleteBus);
