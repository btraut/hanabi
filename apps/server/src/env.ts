import * as dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Load .env from app root or repo root
dotenv.config({ path: path.resolve(__dirname, '../.env') });
dotenv.config({ path: path.resolve(__dirname, '../../../.env') });

export const env = {
	NODE_ENV: process.env.NODE_ENV || 'development',
	PORT: process.env.PORT || '3000',
	SESSION_COOKIE_SECRET: process.env.SESSION_COOKIE_SECRET || 'dev-secret',
	GAME_STORE: process.env.GAME_STORE || 'file',
	REDIS_URL: process.env.REDIS_URL || '',
	REDIRECT_URL_PROTOCOL_AND_SUBDOMAIN: process.env.REDIRECT_URL_PROTOCOL_AND_SUBDOMAIN || '',
	DOMAIN_BASE: process.env.DOMAIN_BASE || 'http://localhost:3000',
};
