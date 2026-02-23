import jwt from 'jsonwebtoken';
import { JWT_CONFIG } from '../config/jwt.config';
import { AuthTokenPayload } from '../modules/auth/auth.types';

export const generateTokens = (payload: AuthTokenPayload) => {
    const accessToken = jwt.sign(payload, JWT_CONFIG.SECRET as jwt.Secret, {
        expiresIn: JWT_CONFIG.EXPIRES_IN as jwt.SignOptions['expiresIn'],
    });

    const refreshToken = jwt.sign(
        { sub: payload.sub, organizationId: payload.organizationId, role: payload.role },
        JWT_CONFIG.REFRESH_SECRET as jwt.Secret,
        {
            expiresIn: JWT_CONFIG.REFRESH_EXPIRES_IN as jwt.SignOptions['expiresIn'],
        }
    );

    return { accessToken, refreshToken };
};

export const verifyRefreshToken = (token: string): AuthTokenPayload => {
    return jwt.verify(token, JWT_CONFIG.REFRESH_SECRET as jwt.Secret) as AuthTokenPayload;
};
