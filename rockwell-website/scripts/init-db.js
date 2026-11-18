const fs = require('fs');
const path = require('path');
const dotenv = require('dotenv');
const bcrypt = require('bcryptjs');
const { Client } = require('pg');

const envPath = path.join(__dirname, '..', '.env');
const envConfig = dotenv.parse(fs.readFileSync(envPath, 'utf8'));

async function initDB() {
  console.log('Connecting to Neon Postgres to initialize tables...');
  const client = new Client({
    connectionString: envConfig.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
  });

  try {
    await client.connect();
    console.log('Connected to Neon Postgres.');

    // 1. Inquiries Table
    await client.query(`
      CREATE TABLE IF NOT EXISTS inquiries (
        id SERIAL PRIMARY KEY,
        type VARCHAR(50) NOT NULL,
        name VARCHAR(255) NOT NULL,
        email VARCHAR(255) NOT NULL,
        phone VARCHAR(50),
        service_requested VARCHAR(100),
        status VARCHAR(50) DEFAULT 'new',
        details JSONB DEFAULT '{}'::jsonb,
        ip_address VARCHAR(100),
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );
    `);
    console.log('✅ Table "inquiries" created or verified.');

    // 2. Admin Users Table
    await client.query(`
      CREATE TABLE IF NOT EXISTS admin_users (
        id SERIAL PRIMARY KEY,
        email VARCHAR(255) UNIQUE NOT NULL,
        password_hash VARCHAR(255) NOT NULL,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );
    `);
    console.log('✅ Table "admin_users" created or verified.');

    // 3. Password Resets Table (with 2-minute token window)
    await client.query(`
      CREATE TABLE IF NOT EXISTS password_resets (
        id SERIAL PRIMARY KEY,
        email VARCHAR(255) NOT NULL,
        code VARCHAR(10) NOT NULL,
        expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
        used BOOLEAN DEFAULT FALSE,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );
    `);
    console.log('✅ Table "password_resets" created or verified.');

    // 4. Rate Limiting Table
    await client.query(`
      CREATE TABLE IF NOT EXISTS login_rate_limits (
        id SERIAL PRIMARY KEY,
        ip_address VARCHAR(100) NOT NULL,
        email VARCHAR(255),
        attempts INTEGER DEFAULT 1,
        locked_until TIMESTAMP WITH TIME ZONE,
        last_attempt TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );
    `);
    console.log('✅ Table "login_rate_limits" created or verified.');

    // 5. Seed default admin user: Kaelmendiola26@gmail.com / admin123
    const defaultEmail = 'Kaelmendiola26@gmail.com';
    const defaultPass = 'admin123';
    const salt = await bcrypt.genSalt(10);
    const hash = await bcrypt.hash(defaultPass, salt);

    const userCheck = await client.query('SELECT * FROM admin_users WHERE email ILIKE $1', [defaultEmail]);
    if (userCheck.rows.length === 0) {
      await client.query(
        'INSERT INTO admin_users (email, password_hash) VALUES ($1, $2)',
        [defaultEmail, hash]
      );
      console.log(`✅ Default Admin user created: ${defaultEmail} (password: ${defaultPass})`);
    } else {
      // Update password hash to make sure it matches admin123
      await client.query(
        'UPDATE admin_users SET password_hash = $1, updated_at = NOW() WHERE email ILIKE $2',
        [hash, defaultEmail]
      );
      console.log(`✅ Default Admin user verified and updated: ${defaultEmail}`);
    }

    await client.end();
    console.log('🎉 Database initialization complete!');
  } catch (err) {
    console.error('❌ Database initialization error:', err);
    process.exit(1);
  }
}

initDB();
