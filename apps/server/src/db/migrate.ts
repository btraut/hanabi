import * as dotenv from 'dotenv';
import path from 'node:path';
import { migrate } from 'drizzle-orm/postgres-js/migrator';
import { createDatabaseConnection } from './database.js';

dotenv.config({ path: path.resolve(process.cwd(), 'apps/server/.env'), quiet: true });
dotenv.config({ path: path.resolve(process.cwd(), '.env'), quiet: true });

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
	throw new Error('DATABASE_URL is required to run database migrations.');
}

const connection = createDatabaseConnection(databaseUrl);
try {
	await migrate(connection.db, { migrationsFolder: path.resolve(process.cwd(), 'drizzle') });
} finally {
	await connection.close();
}
