import { NextFunction, Request, Response } from 'express';
import { Role } from '../constants/roles';

export const requireRole = (...roles: Role[]) => {
	return (req: Request, res: Response, next: NextFunction): void => {
		if (!req.user) {
			res.status(401).json({ message: 'Unauthorized' });
			return;
		}

		if (!roles.includes(req.user.role)) {
			res.status(403).json({ message: 'Forbidden' });
			return;
		}

		next();
	};
};

