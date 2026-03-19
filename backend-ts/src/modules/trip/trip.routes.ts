import { Router } from 'express';
import { requireAuth } from '../../middleware/auth.middleware';
import { requireRole } from '../../middleware/role.middleware';
import { ROLES } from '../../constants/roles';
import { tripController } from './trip.controller';

export const tripRouter = Router();

tripRouter.use(requireAuth, requireRole(ROLES.DRIVER));

tripRouter.get('/active', tripController.getMyActiveTrip);
tripRouter.post('/start', tripController.startTrip);
tripRouter.post('/stop', tripController.stopTrip);
