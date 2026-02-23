import { Request, Response } from 'express';
import { verifyRefreshToken } from '../../utils/generateTokens';
import { generateTokens } from '../../utils/generateTokens';
import { setAuthCookies, clearAuthCookies } from '../../utils/cookies';

export const refreshTokenController = async (req: Request, res: Response): Promise<void> => {
    try {
        // Try to get refresh token from cookie first, then from body
        const refreshToken = req.cookies?.refreshToken || req.body?.refreshToken;

        if (!refreshToken) {
            res.status(401).json({ message: 'Refresh token required' });
            return;
        }

        // Verify refresh token
        const payload = verifyRefreshToken(refreshToken);

        // Generate new tokens
        const { accessToken: newAccessToken, refreshToken: newRefreshToken } = generateTokens({
            sub: payload.sub,
            organizationId: payload.organizationId,
            role: payload.role,
        });

        // Set new cookies
        setAuthCookies(res, newAccessToken, newRefreshToken);

        res.status(200).json({
            accessToken: newAccessToken,
            refreshToken: newRefreshToken,
        });
    } catch (error) {
        res.status(401).json({ message: 'Invalid or expired refresh token' });
    }
};

export const logoutController = async (req: Request, res: Response): Promise<void> => {
    clearAuthCookies(res);
    res.status(200).json({ message: 'Logged out successfully' });
};
