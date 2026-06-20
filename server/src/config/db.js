// PostgreSQL connection pool (works with Supabase hosted Postgres).
import pkg from 'pg';
import dotenv from 'dotenv';

dotenv.config();

const { Pool } = pkg;

// Supabase requires SSL. Toggle via DB_SSL=true in .env.
const useSsl = String(process.env.DB_SSL).toLowerCase() === 'true';

export const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: useSsl ? { rejectUnauthorized: false } : false,
});

// Small helper so controllers can run queries without importing Pool directly.
export const query = (text, params) => pool.query(text, params);

// Verify connectivity at startup (logs a clear French message).
export async function testConnection() {
  try {
    await pool.query('SELECT 1');
    console.log('✅ Connexion à la base de données réussie.');
  } catch (err) {
    console.error('❌ Échec de connexion à la base de données :', err.message);
  }
}
