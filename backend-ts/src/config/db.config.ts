import mongoose from 'mongoose';
import { ENV } from './env.config';
import { logger } from '../utils/logger';

export const connectDB = async (): Promise<void> => {
    try {
        await mongoose.connect(ENV.MONGO_URI as string);
        logger.info('MongoDB connected successfully');
    } catch (error) {
        logger.error('MongoDB connection failed:', error);
        process.exit(1);
    }
};
