import { Request, Response } from 'express';
import { userService } from './user.service';

const getMessage = (error: unknown): string =>
    error instanceof Error ? error.message : 'Something went wrong';

export const userController = {
    getUsers: async (req: Request, res: Response): Promise<void> => {
        try {
            if (!req.user?.organizationId) { res.status(401).json({ message: 'Unauthorized' }); return; }
            const users = await userService.getUsers(req.user.organizationId);
            res.status(200).json({ users });
        } catch (error) {
            res.status(500).json({ message: getMessage(error) });
        }
    },

    getUserById: async (req: Request, res: Response): Promise<void> => {
        try {
            if (!req.user?.organizationId) { res.status(401).json({ message: 'Unauthorized' }); return; }
            const user = await userService.getUserById(req.user.organizationId, String(req.params.id));
            res.status(200).json({ user });
        } catch (error) {
            res.status(404).json({ message: getMessage(error) });
        }
    },

    updateUser: async (req: Request, res: Response): Promise<void> => {
        try {
            if (!req.user?.organizationId) { res.status(401).json({ message: 'Unauthorized' }); return; }
            const user = await userService.updateUser(
                req.user.organizationId,
                String(req.params.id),
                req.body
            );
            res.status(200).json({ user });
        } catch (error) {
            const msg = getMessage(error);
            res.status(msg === 'User not found' ? 404 : 400).json({ message: msg });
        }
    },

    deleteUser: async (req: Request, res: Response): Promise<void> => {
        try {
            if (!req.user?.organizationId) { res.status(401).json({ message: 'Unauthorized' }); return; }
            const result = await userService.deleteUser(req.user.organizationId, String(req.params.id));
            res.status(200).json(result);
        } catch (error) {
            res.status(404).json({ message: getMessage(error) });
        }
    },
};
