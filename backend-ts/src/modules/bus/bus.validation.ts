import { z } from 'zod';
import { TRIP_STATUS_VALUES } from '../../constants/busStatus';

export const createBusSchema = z.object({
    numberPlate: z
        .string()
        .min(1, 'Number plate is required')
        .max(20, 'Number plate must be less than 20 characters')
        .transform((val) => val.trim().toUpperCase()),
    driverId: z.string().optional(),
});

export type CreateBusInput = z.infer<typeof createBusSchema>;

export const busMaintenanceSchema = z.object({
    maintenanceMode: z.boolean(),
});

export const busTripEventSchema = z.object({
    eventType: z.enum(['trip_started', 'trip_completed', 'trip_cancelled', 'trip_delayed', 'transition']),
    delayMinutes: z.number().min(0).optional(),
    nextTripStatus: z.enum(TRIP_STATUS_VALUES as [string, ...string[]]).optional(),
    eventAt: z.string().datetime().optional(),
    routeRemoved: z.boolean().optional(),
});
