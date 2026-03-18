import { Request, Response } from 'express';
import { busService } from './bus.service';
import { busMaintenanceSchema, busTripEventSchema, createBusSchema } from './bus.validation';
import { ZodError } from 'zod';
import { TripStatus } from '../../constants/busStatus';

const getMessage = (error: unknown): string => {
    if (error instanceof Error) {
        return error.message;
    }
    return 'Something went wrong';
};

const getValidationErrors = (error: ZodError): string => {
    return error.issues
        .map((issue: any) => `${issue.path.join('.')}: ${issue.message}`)
        .join(', ');
};

export const busController = {
    createBus: async (req: Request, res: Response): Promise<void> => {
        try {
            if (!req.user?.organizationId) {
                res.status(401).json({ message: 'Unauthorized' });
                return;
            }

            const validatedData = createBusSchema.parse(req.body);

            const bus = await busService.createBus(req.user.organizationId, validatedData);

            res.status(201).json({ bus });
        } catch (error) {
            if (error instanceof ZodError) {
                res.status(400).json({ message: getValidationErrors(error) });
            } else {
                res.status(400).json({ message: getMessage(error) });
            }
        }
    },

    getBuses: async (req: Request, res: Response): Promise<void> => {
        try {
            if (!req.user?.organizationId) {
                res.status(401).json({ message: 'Unauthorized' });
                return;
            }

            const buses = await busService.getBusesByOrganization(req.user.organizationId);

            res.status(200).json({ buses });
        } catch (error) {
            res.status(400).json({ message: getMessage(error) });
        }
    },

    getBusById: async (req: Request, res: Response): Promise<void> => {
        try {
            if (!req.user?.organizationId) {
                res.status(401).json({ message: 'Unauthorized' });
                return;
            }

            const { busId } = req.params as { busId: string };

            const bus = await busService.getBusById(req.user.organizationId, busId);

            res.status(200).json({ bus });
        } catch (error) {
            res.status(error instanceof Error && error.message === 'Bus not found' ? 404 : 400).json({
                message: getMessage(error),
            });
        }
    },

    updateBusDriver: async (req: Request, res: Response): Promise<void> => {
        try {
            if (!req.user?.organizationId) {
                res.status(401).json({ message: 'Unauthorized' });
                return;
            }

            const { busId } = req.params as { busId: string };
            const { memberId } = req.body as { memberId?: string };

            if (!memberId || memberId.trim().length === 0) {
                res.status(400).json({ message: 'memberId is required' });
                return;
            }

            const bus = await busService.updateBusDriver(req.user.organizationId, busId, memberId.trim());

            res.status(200).json({ bus });
        } catch (error) {
            res.status(error instanceof Error && error.message === 'Bus not found' ? 404 : 400).json({
                message: getMessage(error),
            });
        }
    },

    deleteBus: async (req: Request, res: Response): Promise<void> => {
        try {
            if (!req.user?.organizationId) {
                res.status(401).json({ message: 'Unauthorized' });
                return;
            }

            const { busId } = req.params as { busId: string };

            const result = await busService.deleteBus(req.user.organizationId, busId);

            res.status(200).json(result);
        } catch (error) {
            res.status(error instanceof Error && error.message === 'Bus not found' ? 404 : 400).json({
                message: getMessage(error),
            });
        }
    },

    updateBusRoute: async (req: Request, res: Response): Promise<void> => {
        try {
            if (!req.user?.organizationId) {
                res.status(401).json({ message: 'Unauthorized' });
                return;
            }

            const { busId } = req.params as { busId: string };
            const { routeName } = req.body as { routeName?: string };

            if (!routeName || routeName.trim().length === 0) {
                res.status(400).json({ message: 'routeName is required' });
                return;
            }

            const bus = await busService.updateRouteForBus(
                req.user.organizationId,
                busId,
                routeName.trim()
            );

            res.status(200).json({ bus });
        } catch (error) {
            const msg = error instanceof Error ? error.message : 'Something went wrong';
            const status = msg === 'Bus not found' || msg.includes('Route') ? 404 : 400;
            res.status(status).json({ message: msg });
        }
    },

    setBusMaintenanceMode: async (req: Request, res: Response): Promise<void> => {
        try {
            if (!req.user?.organizationId) {
                res.status(401).json({ message: 'Unauthorized' });
                return;
            }

            const { busId } = req.params as { busId: string };
            const { maintenanceMode } = busMaintenanceSchema.parse(req.body);

            const bus = await busService.setMaintenanceMode(
                req.user.organizationId,
                busId,
                maintenanceMode
            );

            res.status(200).json({ bus });
        } catch (error) {
            if (error instanceof ZodError) {
                res.status(400).json({ message: getValidationErrors(error) });
                return;
            }

            const message = getMessage(error);
            res.status(message === 'Bus not found' ? 404 : 400).json({ message });
        }
    },

    applyTripEvent: async (req: Request, res: Response): Promise<void> => {
        try {
            if (!req.user?.organizationId) {
                res.status(401).json({ message: 'Unauthorized' });
                return;
            }

            const { busId } = req.params as { busId: string };
            const payload = busTripEventSchema.parse(req.body);

            const eventAt = payload.eventAt ? new Date(payload.eventAt) : undefined;

            let bus;

            if (payload.eventType === 'transition') {
                if (!payload.nextTripStatus) {
                    res.status(400).json({ message: 'nextTripStatus is required for transition events' });
                    return;
                }

                bus = await busService.transitionTripStatus(
                    req.user.organizationId,
                    busId,
                    payload.nextTripStatus as TripStatus,
                    {
                        routeRemoved: payload.routeRemoved,
                        delayMinutes: payload.delayMinutes,
                        eventAt,
                    }
                );
            } else if (payload.eventType === 'trip_delayed') {
                if (typeof payload.delayMinutes !== 'number') {
                    res.status(400).json({ message: 'delayMinutes is required for trip_delayed event' });
                    return;
                }

                bus = await busService.markTripEvent(req.user.organizationId, busId, {
                    type: 'trip_delayed',
                    delayMinutes: payload.delayMinutes,
                    at: eventAt,
                });
            } else {
                const eventType = payload.eventType;
                bus = await busService.markTripEvent(req.user.organizationId, busId, {
                    type: eventType,
                    at: eventAt,
                });
            }

            res.status(200).json({ bus });
        } catch (error) {
            if (error instanceof ZodError) {
                res.status(400).json({ message: getValidationErrors(error) });
                return;
            }

            const message = getMessage(error);
            const statusCode = message === 'Bus not found' ? 404 : 400;
            res.status(statusCode).json({ message });
        }
    },
};
