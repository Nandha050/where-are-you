import mongoose from 'mongoose';
import { ENV } from './env.config';
import { logger } from '../utils/logger';

const maskMongoUriCredentials = (uri: string): string =>
    uri.replace(/(mongodb(?:\+srv)?:\/\/)([^:@/]+):([^@/]+)@/i, '$1$2:****@');

export const connectDB = async (): Promise<void> => {
    try {
        logger.info(`MongoDB URI: ${maskMongoUriCredentials(ENV.MONGO_URI)}`);
        await mongoose.connect(ENV.MONGO_URI as string);
        logger.info('MongoDB connected successfully');
    } catch (error) {
        logger.error('MongoDB connection failed:', error);
        process.exit(1);
    }
};
