import { NextFunction, Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import { JWT_CONFIG } from '../config/jwt.config';
import { AuthenticatedRequestUser } from '../modules/auth/auth.types';

declare global {
	namespace Express {
		interface Request {
			user?: AuthenticatedRequestUser;
		}
	}
}

export const requireAuth = (req: Request, res: Response, next: NextFunction): void => {
	const authorization = req.headers.authorization;

	if (!authorization?.startsWith('Bearer ')) {
		res.status(401).json({ message: 'Missing or invalid authorization token' });
		return;
	}

	const token = authorization.replace('Bearer ', '').trim();

	try {
		const decoded = jwt.verify(token, JWT_CONFIG.SECRET) as AuthenticatedRequestUser;
		req.user = decoded;
		next();
	} catch (_error) {
		res.status(401).json({ message: 'Invalid or expired token' });
	}
};

