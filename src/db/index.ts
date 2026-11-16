import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import * as schema from './schema.ts';

declare global {
  var _postgresPool: Pool | undefined;
}

export const isTestEnvironment = (): boolean =>
  Boolean(
    process.env.VITEST ||
      process.env.NODE_TEST_CONTEXT ||
      process.env.NODE_ENV === 'test'
  );

export const isCloudSqlConfigured = (): boolean =>
  !isTestEnvironment() &&
  Boolean(
    process.env.SQL_HOST &&
      process.env.SQL_USER &&
      process.env.SQL_PASSWORD &&
      process.env.SQL_DB_NAME
  );

export const createPool = (): Pool => {
  if (!global._postgresPool) {
    global._postgresPool = new Pool({
      host: process.env.SQL_HOST,
      user: process.env.SQL_USER,
      password: process.env.SQL_PASSWORD,
      database: process.env.SQL_DB_NAME,
      max: 8,
      idleTimeoutMillis: 20000,
      connectionTimeoutMillis: 20000,
      keepAlive: true,
      keepAliveInitialDelayMillis: 10000,
    });

    global._postgresPool.on('error', () => {
      // Idle client disconnected (e.g. Cloud SQL scale-to-zero); pool will recreate on next query
    });
  }
  return global._postgresPool;
};

const pool = createPool();

export const db = drizzle(pool, { schema });
