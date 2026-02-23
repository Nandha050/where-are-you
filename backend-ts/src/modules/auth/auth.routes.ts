import { Router } from 'express';
import { requireAuth } from '../../middleware/auth.middleware';
import { requireRole } from '../../middleware/role.middleware';
import { validate } from '../../middleware/validate.middleware';
import { ROLES } from '../../constants/roles';
import { authController } from './auth.controller';
import { signupAdminSchema, loginAdminSchema, loginMemberSchema, createMemberSchema } from './auth.validation';

export const authRouter = Router();

authRouter.post('/admin/signup', validate(signupAdminSchema), authController.signupAdmin);
authRouter.post('/admin/login', validate(loginAdminSchema), authController.loginAdmin);
authRouter.post('/member/login', validate(loginMemberSchema), authController.loginMember);

authRouter.post('/admin/users', requireAuth, requireRole(ROLES.ADMIN), validate(createMemberSchema), authController.createUserByAdmin);
authRouter.post('/admin/drivers', requireAuth, requireRole(ROLES.ADMIN), validate(createMemberSchema), authController.createDriverByAdmin);


