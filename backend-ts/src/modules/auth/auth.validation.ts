import { z } from 'zod';

export const signupAdminSchema = z.object({
    body: z.object({
        name: z.string().min(2, 'name must be at least 2 characters'),
        organizationName: z.string().min(2, 'organizationName must be at least 2 characters'),
        email: z.string().email('invalid email address'),
        password: z.string().min(6, 'password must be at least 6 characters'),
    }),
});

export const loginAdminSchema = z.object({
    body: z.object({
        email: z.string().email('invalid email address'),
        password: z.string().min(1, 'password is required'),
    }),
});

export const loginMemberSchema = z.object({
    body: z.object({
        role: z.enum(['user', 'driver'] as const, { error: 'role must be user or driver' }),
        memberId: z.string().min(1, 'memberId is required'),
        password: z.string().min(1, 'password is required'),
        organizationSlug: z.string().min(1, 'organizationSlug cannot be empty').optional(),
    }),
});

export const createMemberSchema = z.object({
    body: z.object({
        name: z.string().min(2, 'name must be at least 2 characters'),
        memberId: z.string().min(1, 'memberId is required'),
        password: z.string().min(6, 'password must be at least 6 characters'),
    }),
});

export type SignupAdminInput = z.infer<typeof signupAdminSchema>['body'];
export type LoginAdminInput = z.infer<typeof loginAdminSchema>['body'];
export type LoginMemberInput = z.infer<typeof loginMemberSchema>['body'];
export type CreateMemberInput = z.infer<typeof createMemberSchema>['body'];
