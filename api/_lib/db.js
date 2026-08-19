import pg from 'pg';

const { Pool } = pg;

// Reaproveita o pool entre invocações "quentes" da function serverless.
const globalForDb = globalThis;

export function getPool() {
  if (!globalForDb.__pgPool) {
    const connectionString = process.env.DATABASE_URL;
    if (!connectionString) {
      throw new Error('DATABASE_URL não configurada');
    }
    globalForDb.__pgPool = new Pool({
      connectionString,
      max: 5,
      idleTimeoutMillis: 10_000,
    });
  }
  return globalForDb.__pgPool;
}
