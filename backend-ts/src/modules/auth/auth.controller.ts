import { Request, Response } from 'express';
import { ROLES } from '../../constants/roles';
import { authService } from './auth.service';

const getMessage = (error: unknown): string => {
	if (error instanceof Error) {
		return error.message;
	}
	return 'Something went wrong';
};

const hasEmpty = (...values: Array<string | undefined>): boolean => {
	return values.some((value) => !value || value.trim().length === 0);
};

export const authController = {
	signupAdmin: async (req: Request, res: Response): Promise<void> => {
		try {
			const { name, organizationName, email, password } = req.body as {
				name?: string;
				organizationName?: string;
				email?: string;
				password?: string;
			};

			if (hasEmpty(name, organizationName, email, password)) {
				res.status(400).json({ message: 'name, organizationName, email and password are required' });
				return;
			}

			const data = await authService.signupAdmin({
				name: name as string,
				organizationName: organizationName as string,
				email: email as string,
				password: password as string,
			});

			res.status(201).json(data);
		} catch (error) {
			res.status(400).json({ message: getMessage(error) });
		}
	},

	loginAdmin: async (req: Request, res: Response): Promise<void> => {
		try {
			const { email, password } = req.body as { email?: string; password?: string };

			if (hasEmpty(email, password)) {
				res.status(400).json({ message: 'email and password are required' });
				return;
			}

			const data = await authService.loginAdmin({
				email: email as string,
				password: password as string,
			});

			res.status(200).json(data);
		} catch (error) {
			res.status(401).json({ message: getMessage(error) });
		}
	},

	loginMember: async (req: Request, res: Response): Promise<void> => {
		try {
			const { role, memberId, password, organizationSlug } = req.body as {
				role?: string;
				memberId?: string;
				password?: string;
				organizationSlug?: string;
			};

			if (hasEmpty(role, memberId, password)) {
				res.status(400).json({ message: 'role, memberId and password are required' });
				return;
			}

			if (![ROLES.USER, ROLES.DRIVER].includes(role as 'user' | 'driver')) {
				res.status(400).json({ message: 'role must be user or driver' });
				return;
			}

			const data = await authService.loginMember({
				role: role as 'user' | 'driver',
				memberId: memberId as string,
				password: password as string,
				organizationSlug,
			});

			res.status(200).json(data);
		} catch (error) {
			res.status(401).json({ message: getMessage(error) });
		}
	},

	createUserByAdmin: async (req: Request, res: Response): Promise<void> => {
		try {
			const { name, memberId, password } = req.body as {
				name?: string;
				memberId?: string;
				password?: string;
			};

			if (hasEmpty(name, memberId, password)) {
				res.status(400).json({ message: 'name, memberId and password are required' });
				return;
			}

			if (!req.user?.organizationId) {
				res.status(401).json({ message: 'Unauthorized' });
				return;
			}

			const user = await authService.createUserByAdmin(req.user.organizationId, {
				name: name as string,
				memberId: memberId as string,
				password: password as string,
			});

			res.status(201).json({ user });
		} catch (error) {
			res.status(400).json({ message: getMessage(error) });
		}
	},

	createDriverByAdmin: async (req: Request, res: Response): Promise<void> => {
		try {
			const { name, memberId, password } = req.body as {
				name?: string;
				memberId?: string;
				password?: string;
			};

			if (hasEmpty(name, memberId, password)) {
				res.status(400).json({ message: 'name, memberId and password are required' });
				return;
			}

			if (!req.user?.organizationId) {
				res.status(401).json({ message: 'Unauthorized' });
				return;
			}

			const driver = await authService.createDriverByAdmin(req.user.organizationId, {
				name: name as string,
				memberId: memberId as string,
				password: password as string,
			});

			res.status(201).json({ driver });
		} catch (error) {
			res.status(400).json({ message: getMessage(error) });
		}
	},
};

