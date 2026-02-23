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
    // Try to get token from cookie first, then fall back to Authorization header
    let token = req.cookies?.accessToken;

    if (!token) {
        const authorization = req.headers.authorization;
        if (authorization?.startsWith('Bearer ')) {
            token = authorization.replace('Bearer ', '').trim();
        }
    }

    if (!token) {
        res.status(401).json({ message: 'Missing or invalid authorization token' });
        return;
    }

    try {
        const decoded = jwt.verify(token, JWT_CONFIG.SECRET) as AuthenticatedRequestUser;
        req.user = decoded;
        next();
    } catch (_error) {
        res.status(401).json({ message: 'Invalid or expired token' });
    }
};

