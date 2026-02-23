import { Response } from 'express';
import { ENV } from '../config/env.config';

const isProduction = ENV.NODE_ENV === 'production';

export const setAuthCookies = (res: Response, accessToken: string, refreshToken: string): void => {
    // Access token - 7 days
    res.cookie('accessToken', accessToken, {
        httpOnly: true,
        secure: isProduction,
        sameSite: 'strict',
        maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days in ms
    });

    // Refresh token - 30 days
    res.cookie('refreshToken', refreshToken, {
        httpOnly: true,
        secure: isProduction,
        sameSite: 'strict',
        maxAge: 30 * 24 * 60 * 60 * 1000, // 30 days in ms
    });
};

export const clearAuthCookies = (res: Response): void => {
    res.clearCookie('accessToken');
    res.clearCookie('refreshToken');
};
