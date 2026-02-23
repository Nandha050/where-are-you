import { Request, Response } from 'express';
import { authService } from './auth.service';
import { SignupAdminInput, LoginAdminInput, LoginMemberInput, CreateMemberInput } from './auth.validation';

const getMessage = (error: unknown): string => {
	if (error instanceof Error) {
		return error.message;
	}
	return 'Something went wrong';
};

export const authController = {
	signupAdmin: async (req: Request, res: Response): Promise<void> => {
		try {
			const { name, organizationName, email, password } = req.body as SignupAdminInput;

			const data = await authService.signupAdmin({ name, organizationName, email, password });

			res.status(201).json(data);
		} catch (error) {
			res.status(400).json({ message: getMessage(error) });
		}
	},

	loginAdmin: async (req: Request, res: Response): Promise<void> => {
		try {
			const { email, password } = req.body as LoginAdminInput;

			const data = await authService.loginAdmin({ email, password });

			res.status(200).json(data);
		} catch (error) {
			res.status(401).json({ message: getMessage(error) });
		}
	},

	loginMember: async (req: Request, res: Response): Promise<void> => {
		try {
			const { role, memberId, password, organizationSlug } = req.body as LoginMemberInput;

			const data = await authService.loginMember({ role, memberId, password, organizationSlug });

			res.status(200).json(data);
		} catch (error) {
			res.status(401).json({ message: getMessage(error) });
		}
	},

	createUserByAdmin: async (req: Request, res: Response): Promise<void> => {
		try {
			const { name, memberId, password } = req.body as CreateMemberInput;

			if (!req.user?.organizationId) {
				res.status(401).json({ message: 'Unauthorized' });
				return;
			}

			const user = await authService.createUserByAdmin(req.user.organizationId, { name, memberId, password });

			res.status(201).json({ user });
		} catch (error) {
			res.status(400).json({ message: getMessage(error) });
		}
	},

	createDriverByAdmin: async (req: Request, res: Response): Promise<void> => {
		try {
			const { name, memberId, password } = req.body as CreateMemberInput;

			if (!req.user?.organizationId) {
				res.status(401).json({ message: 'Unauthorized' });
				return;
			}

			const driver = await authService.createDriverByAdmin(req.user.organizationId, { name, memberId, password });

			res.status(201).json({ driver });
		} catch (error) {
			res.status(400).json({ message: getMessage(error) });
		}
	},
};

