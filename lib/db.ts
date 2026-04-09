import pg from "pg";

const { Pool } = pg;

let pool: pg.Pool | null = null;

function getPool(): pg.Pool | null {
  if (!process.env.DATABASE_URL) {
    return null;
  }
  if (!pool) {
    pool = new Pool({
      connectionString: process.env.DATABASE_URL,
    });
  }
  return pool;
}

let initialized = false;

async function ensureTables() {
  if (initialized) return;
  const p = getPool();
  if (!p) return;

  await p.query(`
    CREATE TABLE IF NOT EXISTS sessions (
      id TEXT PRIMARY KEY,
      created_at TIMESTAMP DEFAULT NOW()
    );
  `);
  await p.query(`
    CREATE TABLE IF NOT EXISTS generations (
      id SERIAL PRIMARY KEY,
      session_id TEXT REFERENCES sessions(id),
      endpoint TEXT NOT NULL,
      created_at TIMESTAMP DEFAULT NOW()
    );
  `);

  initialized = true;
}

export async function query(text: string, params?: unknown[]) {
  const p = getPool();
  if (!p) return null;
  await ensureTables();
  return p.query(text, params);
}

export function hasDatabase() {
  return !!process.env.DATABASE_URL;
}
