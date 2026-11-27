const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const dotenv = require('dotenv');
const bcrypt = require('bcryptjs');
const { Client } = require('pg');

const envPath = path.join(__dirname, '..', '.env');
const envConfig = fs.existsSync(envPath) ? dotenv.parse(fs.readFileSync(envPath, 'utf8')) : {};

async function initDB() {
  const connectionString =
    process.env.DEV_MIGRATION_DATABASE_URL ||
    envConfig.DEV_MIGRATION_DATABASE_URL ||
    process.env.DEV_DATABASE_URL ||
    envConfig.DEV_DATABASE_URL ||
    envConfig.DATABASE_URL;

  console.log('Connecting to Neon Postgres to initialize tables...');
  const client = new Client({
    connectionString,
    ssl: { rejectUnauthorized: false }
  });

  try {
    await client.connect();
    console.log('Connected to Neon Postgres.');

    // Run additive schema migrations via migrate-db.js first
    console.log('ℹ️ Note: Use `npm run migrate` for full schema & index migrations.');

    // Seed initial admin user ONLY if missing (NEVER overwrite an existing admin password hash!)
    const seedEmail = process.env.INITIAL_ADMIN_EMAIL || envConfig.INITIAL_ADMIN_EMAIL || 'info@rockwelltaxdigital.com';
    const userCheck = await client.query('SELECT id, email FROM admin_users WHERE LOWER(email) = LOWER($1)', [seedEmail]);

    if (userCheck.rows.length === 0) {
      const initialPassword =
        process.env.INITIAL_ADMIN_PASSWORD ||
        envConfig.INITIAL_ADMIN_PASSWORD ||
        crypto.randomBytes(12).toString('base64url');
      const salt = await bcrypt.genSalt(12);
      const hash = await bcrypt.hash(initialPassword, salt);

      await client.query(
        'INSERT INTO admin_users (email, password_hash) VALUES ($1, $2)',
        [seedEmail, hash]
      );
      console.log(`✅ Seeded initial admin user: ${seedEmail}`);
      if (!process.env.INITIAL_ADMIN_PASSWORD && !envConfig.INITIAL_ADMIN_PASSWORD) {
        console.log(`🔑 Generated one-time initial password: ${initialPassword}`);
      }
    } else {
      console.log(`✅ Existing admin user preserved without overwriting password: ${userCheck.rows[0].email}`);
    }

    await client.end();
    console.log('🎉 Database initialization complete!');
  } catch (err) {
    console.error('❌ Database initialization error:', err.message);
    process.exit(1);
  }
}

initDB();
