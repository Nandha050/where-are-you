import jwt from 'jsonwebtoken';
import { ExtendedError, Socket } from 'socket.io';
import { JWT_CONFIG } from '../config/jwt.config';
import { AuthenticatedRequestUser } from '../modules/auth/auth.types';

const parseTokenFromHandshake = (socket: Socket): string | null => {
    const authToken = socket.handshake.auth?.token;
    if (typeof authToken === 'string' && authToken.trim()) {
        return authToken.trim();
    }

    const authorization = socket.handshake.headers.authorization;
    if (typeof authorization === 'string' && authorization.startsWith('Bearer ')) {
        return authorization.replace('Bearer ', '').trim();
    }

    const cookieHeader = socket.handshake.headers.cookie;
    if (typeof cookieHeader === 'string') {
        const cookies = cookieHeader.split(';').map((entry) => entry.trim());
        const accessTokenCookie = cookies.find((entry) => entry.startsWith('accessToken='));
        if (accessTokenCookie) {
            return decodeURIComponent(accessTokenCookie.split('=').slice(1).join('='));
        }
    }

    return null;
};

export const authenticateSocket = (
    socket: Socket,
    next: (err?: ExtendedError) => void
): void => {
    try {
        const token = parseTokenFromHandshake(socket);

        if (!token) {
            next(new Error('Unauthorized: missing token'));
            return;
        }

        const decoded = jwt.verify(token, JWT_CONFIG.SECRET) as AuthenticatedRequestUser;
        socket.data.user = {
            sub: decoded.sub,
            organizationId: decoded.organizationId,
            role: decoded.role,
        };

        next();
    } catch (_error) {
        next(new Error('Unauthorized: invalid or expired token'));
    }
};
