import { randomBytes, scrypt as scryptCallback } from 'crypto';
import { promisify } from 'util';

const scryptAsync = promisify(scryptCallback);

export const hashPassword = async (plainPassword: string): Promise<string> => {
	const salt = randomBytes(16).toString('hex');
	const derivedKey = (await scryptAsync(plainPassword, salt, 64)) as Buffer;

	return `${salt}:${derivedKey.toString('hex')}`;
};

