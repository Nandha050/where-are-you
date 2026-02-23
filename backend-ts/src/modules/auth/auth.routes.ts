import { Router } from 'express';
import { requireAuth } from '../../middleware/auth.middleware';
import { requireRole } from '../../middleware/role.middleware';
import { ROLES } from '../../constants/roles';
import { authController } from './auth.controller';

export const authRouter = Router();

authRouter.post('/admin/signup', authController.signupAdmin);
authRouter.post('/admin/login', authController.loginAdmin);
authRouter.post('/member/login', authController.loginMember);

authRouter.post('/admin/users', requireAuth, requireRole(ROLES.ADMIN), authController.createUserByAdmin);
authRouter.post('/admin/drivers', requireAuth, requireRole(ROLES.ADMIN), authController.createDriverByAdmin);

