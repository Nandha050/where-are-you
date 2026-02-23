import { Router } from 'express';
import { requireAuth } from '../../middleware/auth.middleware';
import { requireRole } from '../../middleware/role.middleware';
import { validate } from '../../middleware/validate.middleware';
import { ROLES } from '../../constants/roles';
import { stopController } from './stop.controller';
import { z } from 'zod';

export const stopRouter = Router();

const createStopSchema = z.object({
    body: z.object({
        name: z.string().min(1, 'name is required'),
        latitude: z.number({ error: 'latitude must be a number' }),
        longitude: z.number({ error: 'longitude must be a number' }),
        sequenceOrder: z.number({ error: 'sequenceOrder must be a number' }).int('sequenceOrder must be an integer').min(1, 'sequenceOrder must be at least 1'),
        radiusMeters: z.number().positive('radiusMeters must be positive').optional(),
    }),
});

const updateStopSchema = z.object({
    body: z.object({
        name: z.string().min(1).optional(),
        latitude: z.number().optional(),
        longitude: z.number().optional(),
        sequenceOrder: z.number().int().min(1).optional(),
        radiusMeters: z.number().positive().optional(),
    }),
});

stopRouter.use(requireAuth, requireRole(ROLES.ADMIN));

// Routes under /api/admin/routes/:routeId/stops
stopRouter.post('/routes/:routeId/stops', validate(createStopSchema), stopController.createStop);
stopRouter.get('/routes/:routeId/stops', stopController.getStopsByRoute);

// Routes under /api/admin/stops/:id
stopRouter.put('/stops/:id', validate(updateStopSchema), stopController.updateStop);
stopRouter.delete('/stops/:id', stopController.deleteStop);
