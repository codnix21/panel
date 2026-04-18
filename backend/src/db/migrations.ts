import { pool } from './index';
import bcrypt from 'bcrypt';

export async function runMigrations(): Promise<void> {
  const client = await pool.connect();
  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        username VARCHAR(255) UNIQUE NOT NULL,
        password_hash VARCHAR(255) NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS nodes (
        id SERIAL PRIMARY KEY,
        name VARCHAR(255) NOT NULL DEFAULT '',
        ip VARCHAR(255) NOT NULL,
        port INTEGER NOT NULL,
        token VARCHAR(255) NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS audit_log (
        id SERIAL PRIMARY KEY,
        user_id INTEGER,
        username VARCHAR(255),
        action VARCHAR(100) NOT NULL,
        resource_type VARCHAR(50),
        resource_id VARCHAR(100),
        details JSONB,
        ip VARCHAR(128),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_audit_log_created_at ON audit_log (created_at DESC);
    `);

    await client.query(`
      ALTER TABLE nodes ADD COLUMN IF NOT EXISTS last_seen_at TIMESTAMP;
    `);
    await client.query(`
      ALTER TABLE users ADD COLUMN IF NOT EXISTS totp_secret VARCHAR(128);
    `);
    await client.query(`
      ALTER TABLE users ADD COLUMN IF NOT EXISTS totp_enabled BOOLEAN DEFAULT FALSE;
    `);
    await client.query(`
      ALTER TABLE users ADD COLUMN IF NOT EXISTS token_version INTEGER NOT NULL DEFAULT 0;
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS proxy_templates (
        id SERIAL PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        preset JSONB NOT NULL DEFAULT '{}',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS proxy_meta (
        node_id INTEGER NOT NULL REFERENCES nodes(id) ON DELETE CASCADE,
        proxy_id VARCHAR(64) NOT NULL,
        tags TEXT[] DEFAULT '{}',
        PRIMARY KEY (node_id, proxy_id)
      );
    `);

    console.log('Database migrations completed');
  } finally {
    client.release();
  }
}

export async function createAdminUser(username: string, password: string): Promise<void> {
  const client = await pool.connect();
  try {
    const existing = await client.query('SELECT id FROM users WHERE username = $1', [username]);
    if (existing.rows.length > 0) {
      console.log('Admin user already exists');
      return;
    }

    const hash = await bcrypt.hash(password, 12);
    await client.query('INSERT INTO users (username, password_hash) VALUES ($1, $2)', [username, hash]);
    console.log(`Admin user "${username}" created`);
  } finally {
    client.release();
  }
}
