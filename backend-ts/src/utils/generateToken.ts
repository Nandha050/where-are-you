import jwt from 'jsonwebtoken';
import { JWT_CONFIG } from '../config/jwt.config';
import { AuthTokenPayload } from '../modules/auth/auth.types';

export const generateToken = (payload: AuthTokenPayload): string => {
	return jwt.sign(payload, JWT_CONFIG.SECRET as jwt.Secret, {
		expiresIn: JWT_CONFIG.EXPIRES_IN as jwt.SignOptions['expiresIn'],
	});
};

