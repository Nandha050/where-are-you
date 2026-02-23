import express, { Request, Response } from 'express';
import { connectDB } from './config/db.config';
import { ENV } from './config/env.config';
import { logger } from './utils/logger';
import { authRouter } from './modules/auth/auth.routes';
import { busRouter } from './modules/bus/bus.routes';
import { driverRouter } from './modules/driver/driver.routes';

const app = express();

app.use(express.json());
app.get('/', (_req, res) => {
    res.status(200).json({ message: 'Where Are You backend is running' });
});
app.use('/api/auth', authRouter);
app.use('/api/buses', busRouter);
app.use('/api/driver', driverRouter);

connectDB().then(() => {
    app.listen(ENV.PORT, () => {
        logger.info(`Server is running on port http://localhost:${ENV.PORT}`);
    });
});