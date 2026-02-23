import { scrypt as scryptCallback, timingSafeEqual } from 'crypto';
import { promisify } from 'util';

const scryptAsync = promisify(scryptCallback);

export const comparePassword = async (plainPassword: string, passwordHash: string): Promise<boolean> => {
	const [salt, keyHex] = passwordHash.split(':');

	if (!salt || !keyHex) {
		return false;
	}

	const storedKey = Buffer.from(keyHex, 'hex');
	const derivedKey = (await scryptAsync(plainPassword, salt, storedKey.length)) as Buffer;

	return timingSafeEqual(storedKey, derivedKey);
};

