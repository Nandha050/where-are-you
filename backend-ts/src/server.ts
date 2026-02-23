import express from 'express';
import { connectDB } from './config/db.config';
import { ENV } from './config/env.config';
import { logger } from './utils/logger';

const app = express();

app.use(express.json());

connectDB().then(() => {
    app.listen(ENV.PORT, () => {
        logger.info(`Server is running on port http://localhost${ENV.PORT}`);
    });
});