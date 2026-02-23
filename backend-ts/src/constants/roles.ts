export const ROLES = {
	ADMIN: 'admin',
	USER: 'user',
	DRIVER: 'driver',
} as const;

export type Role = (typeof ROLES)[keyof typeof ROLES];

