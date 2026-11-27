const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
const { Pool } = require('pg');

const isProduction = process.env.NODE_ENV === 'production';

// Strictly separate runtime production DATABASE_URL from DEV_DATABASE_URL.
// Never load MIGRATION_DATABASE_URL in runtime API handlers.
const CONNECTION_STRING = isProduction
  ? (process.env.DATABASE_URL || '')
  : (process.env.DEV_DATABASE_URL || process.env.DATABASE_URL || '');

const pool = new Pool({
  connectionString: CONNECTION_STRING,
  ssl: { rejectUnauthorized: false },
  max: 10,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000,
  statement_timeout: 8000
});

pool.on('error', (err) => {
  console.error('Unexpected error on idle Neon DB client:', err.message);
});

module.exports = {
  query: (text, params) => pool.query(text, params),
  getClient: () => pool.connect(),
  pool,
  isProduction
};
