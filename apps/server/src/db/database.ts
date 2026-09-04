import { drizzle, PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import postgres, { Sql } from 'postgres';
import * as schema from './schema.js';

export interface DatabaseConnection {
	client: Sql;
	db: PostgresJsDatabase<typeof schema>;
	close(timeoutSeconds?: number): Promise<void>;
}

export function createDatabaseConnection(databaseUrl: string): DatabaseConnection {
	const client = postgres(databaseUrl, {
		max: 2,
		connect_timeout: 3,
		idle_timeout: 20,
		connection: {
			application_name: 'hanabi-transcripts',
			statement_timeout: 3_000,
			lock_timeout: 2_000,
		},
	});
	const db = drizzle({ client, schema });

	return {
		client,
		db,
		async close(timeoutSeconds = 3) {
			await client.end({ timeout: timeoutSeconds });
		},
	};
}
