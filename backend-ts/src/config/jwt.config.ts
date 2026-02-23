import { ENV } from './env.config';

export const JWT_CONFIG = {
	SECRET: ENV.JWT_SECRET,
	EXPIRES_IN: ENV.JWT_EXPIRES_IN,
};

