import { Request, Response } from 'express';

export const authDebugController = {
    whoami: async (req: Request, res: Response): Promise<void> => {
        if (!req.user) {
            res.status(401).json({ message: 'Not authenticated' });
            return;
        }

        res.status(200).json({
            message: 'Token decoded successfully',
            user: req.user,
        });
    },
};
