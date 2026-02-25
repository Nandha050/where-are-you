import { Server as HttpServer } from 'http';
import { Server } from 'socket.io';
import { logger } from '../utils/logger';
import { registerSocketHandlers } from './socket.handlers';
import { authenticateSocket } from './socket.auth';
import { ENV } from '../config/env.config';

let io: Server | null = null;

export const initSocket = (server: HttpServer): Server => {
	io = new Server(server, {
		cors: {
			origin: ENV.FRONTEND_URLS.length > 0 ? ENV.FRONTEND_URLS : '*',
			methods: ['GET', 'POST'],
			credentials: true,
		},
	});

	io.use(authenticateSocket);

	io.on('connection', (socket) => {
		logger.info(`Socket client connected: ${socket.id} (${socket.data.user?.role || 'unknown'})`);
		registerSocketHandlers(socket);
	});

	return io;
};

export const getIO = (): Server => {
	if (!io) {
		throw new Error('Socket.io not initialized');
	}

	return io;
};
