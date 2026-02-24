import express, { Request, Response } from 'express';
import cookieParser from 'cookie-parser';
import { connectDB } from './config/db.config';
import { ENV } from './config/env.config';
import { logger } from './utils/logger';
import { authRouter } from './modules/auth/auth.routes';
import { busRouter } from './modules/bus/bus.routes';
import { driverRouter } from './modules/driver/driver.routes';
import { routeRouter } from './modules/route/route.routes';
import { stopRouter } from './modules/stop/stop.routes';
import { userRouter } from './modules/user/user.routes';


import cors from 'cors';
const app = express();
// Add CORS middleware with configuration
app.use(cors({
    origin: process.env.FRONTEND_URL, // Allow requests from the frontend URL
    credentials: true, // Include credentials (cookies, authorization headers, etc.)
}));

app.use(express.json());
app.use(cookieParser());
app.get('/', (_req, res) => {
    res.status(200).json({ message: 'Where Are You backend is running' });
});
app.use('/api/auth', authRouter);
app.use('/api/buses', busRouter);
app.use('/api/driver', driverRouter);
app.use('/api/admin/routes', routeRouter);
app.use('/api/admin', stopRouter);
app.use('/api/admin/users', userRouter);

connectDB().then(() => {
    app.listen(ENV.PORT, () => {
        logger.info(`Server is running on port http://localhost:${ENV.PORT}`);
    });
});