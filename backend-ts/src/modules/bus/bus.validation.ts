import { z } from 'zod';

export const createBusSchema = z.object({
    numberPlate: z
        .string()
        .min(1, 'Number plate is required')
        .max(20, 'Number plate must be less than 20 characters')
        .transform((val) => val.trim().toUpperCase()),
    driverId: z.string().optional(),
});

export type CreateBusInput = z.infer<typeof createBusSchema>;
