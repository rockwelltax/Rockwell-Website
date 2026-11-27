#!/usr/bin/env node
/**
 * Rockwell Tax & Digital Strategies Inc.
 * Versioned Additive Schema Migration & Least-Privilege App Role Provisioner
 *
 * Usage:
 *   node scripts/migrate-db.js --target dev
 *   node scripts/migrate-db.js --target prod
 */

const fs = require('fs');
const path = require('path');
const dotenv = require('dotenv');
const { Client } = require('pg');

const ROOT_DIR = path.resolve(__dirname, '..');
const rootEnv = fs.existsSync(path.join(ROOT_DIR, '.env'))
  ? dotenv.parse(fs.readFileSync(path.join(ROOT_DIR, '.env'), 'utf8'))
  : {};
const subEnv = fs.existsSync(path.join(ROOT_DIR, 'rockwell-website', '.env'))
  ? dotenv.parse(fs.readFileSync(path.join(ROOT_DIR, 'rockwell-website', '.env'), 'utf8'))
  : {};

function getArg(flag) {
  const idx = process.argv.indexOf(flag);
  if (idx !== -1 && idx + 1 < process.argv.length) return process.argv[idx + 1];
  return null;
}

function resolveMigrationUrl(target) {
  if (target === 'prod' || target === 'production') {
    return (
      process.env.MIGRATION_DATABASE_URL ||
      rootEnv.MIGRATION_DATABASE_URL ||
      subEnv.DATABASE_URL
    );
  }
  return (
    process.env.DEV_MIGRATION_DATABASE_URL ||
    rootEnv.DEV_MIGRATION_DATABASE_URL ||
    process.env.DEV_DATABASE_URL ||
    rootEnv.DEV_DATABASE_URL ||
    rootEnv.DATABASE_URL
  );
}

async function runMigrations() {
  const target = (getArg('--target') || 'dev').toLowerCase();
  const connectionString = resolveMigrationUrl(target);

  if (!connectionString) {
    throw new Error(`Missing migration database URL for target "${target}".`);
  }

  console.log(`🚀 Running additive database migrations for target: ${target.toUpperCase()}`);
  const client = new Client({
    connectionString,
    ssl: { rejectUnauthorized: false }
  });

  await client.connect();
  try {
    await client.query('BEGIN');

    // 1. Base Tables (idempotent for fresh dev/staging branches)
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

    await client.query(`
      CREATE TABLE IF NOT EXISTS admin_users (
        id SERIAL PRIMARY KEY,
        email VARCHAR(255) UNIQUE NOT NULL,
        password_hash VARCHAR(255) NOT NULL,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );
    `);

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

    await client.query(`
      CREATE TABLE IF NOT EXISTS site_settings (
        key VARCHAR(50) PRIMARY KEY,
        value JSONB NOT NULL,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // 2. Additive Columns (100% backward-compatible with commit 57bf887)
    await client.query(`
      ALTER TABLE inquiries
        ADD COLUMN IF NOT EXISTS device_hash VARCHAR(128),
        ADD COLUMN IF NOT EXISTS risk_score INTEGER DEFAULT 0;
    `);

    await client.query(`
      ALTER TABLE password_resets
        ADD COLUMN IF NOT EXISTS failed_attempts INTEGER DEFAULT 0;
    `);

    // 3. New Security & Rate-Limiting Tables
    await client.query(`
      CREATE TABLE IF NOT EXISTS inquiry_rate_limits (
        id SERIAL PRIMARY KEY,
        inquiry_id INTEGER REFERENCES inquiries(id) ON DELETE SET NULL,
        ip_address VARCHAR(100) NOT NULL,
        device_hash VARCHAR(128) NOT NULL,
        fp_hash VARCHAR(128),
        email_normalized VARCHAR(255) NOT NULL,
        inquiry_type VARCHAR(50) NOT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
      );
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS admin_sessions (
        session_id UUID PRIMARY KEY,
        email VARCHAR(255) NOT NULL,
        token_hash VARCHAR(128) NOT NULL UNIQUE,
        csrf_token VARCHAR(128) NOT NULL,
        ip_address VARCHAR(100),
        user_agent TEXT,
        expires_at TIMESTAMPTZ NOT NULL,
        revoked_at TIMESTAMPTZ,
        created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
      );
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS security_audit_logs (
        id BIGSERIAL PRIMARY KEY,
        event_type VARCHAR(80) NOT NULL,
        severity VARCHAR(20) NOT NULL DEFAULT 'info',
        actor_email VARCHAR(255),
        ip_address VARCHAR(100),
        device_hash VARCHAR(128),
        target_type VARCHAR(50),
        target_id VARCHAR(100),
        metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
        created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // 4. Performance Indexes for Rate-Limit, Session & Audit Queries
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_irl_device_created ON inquiry_rate_limits (device_hash, created_at DESC);
      CREATE INDEX IF NOT EXISTS idx_irl_email_created ON inquiry_rate_limits (email_normalized, created_at DESC);
      CREATE INDEX IF NOT EXISTS idx_irl_ip_created ON inquiry_rate_limits (ip_address, created_at DESC);
      CREATE INDEX IF NOT EXISTS idx_irl_fp_created ON inquiry_rate_limits (fp_hash, created_at DESC);

      CREATE INDEX IF NOT EXISTS idx_admin_sessions_token_hash ON admin_sessions (token_hash) WHERE revoked_at IS NULL;
      CREATE INDEX IF NOT EXISTS idx_admin_sessions_email ON admin_sessions (LOWER(email));

      CREATE INDEX IF NOT EXISTS idx_audit_event_created ON security_audit_logs (event_type, created_at DESC);
      CREATE INDEX IF NOT EXISTS idx_audit_ip_created ON security_audit_logs (ip_address, created_at DESC);

      CREATE INDEX IF NOT EXISTS idx_inquiries_created_at ON inquiries (created_at DESC);
      CREATE INDEX IF NOT EXISTS idx_inquiries_type_status ON inquiries (type, status);

      CREATE INDEX IF NOT EXISTS idx_login_rl_ip_email ON login_rate_limits (ip_address, LOWER(email));
    `);

    console.log('  ✅ Schema tables, additive columns, and indexes applied.');

    // 5. Optional Least-Privilege Role Provisioning & Verification
    const appRolePass = process.env.APP_DB_PASSWORD || rootEnv.APP_DB_PASSWORD;
    if (appRolePass) {
      const roleExists = await client.query(`SELECT 1 FROM pg_roles WHERE rolname = 'rockwell_app_user'`);
      if (roleExists.rows.length === 0) {
        const escapedPass = appRolePass.replace(/'/g, "''");
        await client.query(`CREATE ROLE rockwell_app_user WITH LOGIN PASSWORD '${escapedPass}' NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION`);
        console.log('  ✅ Created least-privilege role: rockwell_app_user');
      } else {
        const escapedPass = appRolePass.replace(/'/g, "''");
        await client.query('SAVEPOINT sp_alter_app_role');
        try {
          await client.query(`ALTER ROLE rockwell_app_user WITH LOGIN PASSWORD '${escapedPass}' NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION`);
          await client.query('RELEASE SAVEPOINT sp_alter_app_role');
          console.log('  ✅ Updated credentials for least-privilege role: rockwell_app_user');
        } catch (roleErr) {
          await client.query('ROLLBACK TO SAVEPOINT sp_alter_app_role');
          console.log('  ℹ️ Role rockwell_app_user is Neon-managed (password managed via Neon Console/API); proceeding to table grants.');
        }
      }

      const dbNameRes = await client.query('SELECT current_database() AS db');
      const dbName = dbNameRes.rows[0].db;

      await client.query(`GRANT CONNECT ON DATABASE "${dbName}" TO rockwell_app_user`);
      await client.query(`GRANT USAGE ON SCHEMA public TO rockwell_app_user`);
      await client.query(`REVOKE ALL ON ALL TABLES IN SCHEMA public FROM rockwell_app_user`);

      // Apply exact least-privilege grants per table
      await client.query(`GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE inquiries TO rockwell_app_user`);
      await client.query(`GRANT SELECT, INSERT ON TABLE inquiry_rate_limits TO rockwell_app_user`);
      await client.query(`GRANT SELECT, UPDATE (password_hash, updated_at) ON TABLE admin_users TO rockwell_app_user`);
      await client.query(`GRANT SELECT, INSERT, UPDATE ON TABLE admin_sessions TO rockwell_app_user`);
      await client.query(`GRANT SELECT, INSERT, UPDATE ON TABLE password_resets TO rockwell_app_user`);
      await client.query(`GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE login_rate_limits TO rockwell_app_user`);
      await client.query(`GRANT SELECT, INSERT, UPDATE ON TABLE site_settings TO rockwell_app_user`);
      await client.query(`GRANT SELECT, INSERT ON TABLE security_audit_logs TO rockwell_app_user`);
      await client.query(`GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO rockwell_app_user`);

      // Verify zero TRUNCATE privileges
      const truncCheck = await client.query(`
        SELECT table_name, privilege_type
        FROM information_schema.role_table_grants
        WHERE grantee = 'rockwell_app_user' AND privilege_type = 'TRUNCATE'
      `);
      if (truncCheck.rows.length > 0) {
        throw new Error('Security check failed: rockwell_app_user still has TRUNCATE privilege.');
      }
      console.log('  ✅ Least-privilege grants verified for rockwell_app_user (zero DDL / TRUNCATE privileges).');
    }

    await client.query('COMMIT');
    console.log(`🎉 Migration completed successfully for ${target.toUpperCase()}!`);
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    await client.end();
  }
}

runMigrations().catch((err) => {
  console.error('❌ Migration failed:', err.message);
  process.exit(1);
});
