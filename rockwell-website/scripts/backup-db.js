#!/usr/bin/env node
/**
 * Rockwell Tax & Digital Strategies Inc.
 * Dynamic Full-Schema Database Backup & Isolated Restore Verifier
 *
 * Usage:
 *   node scripts/backup-db.js --source <url|prod|dev>
 *   node scripts/backup-db.js --verify-restore <backupFile> --target <url|dev>
 *   node scripts/backup-db.js --restore <backupFile> --target <url>
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
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

function resolveDbUrl(spec) {
  if (!spec || spec === 'prod' || spec === 'production') {
    return (
      process.env.MIGRATION_DATABASE_URL ||
      rootEnv.MIGRATION_DATABASE_URL ||
      subEnv.DATABASE_URL ||
      process.env.DATABASE_URL ||
      rootEnv.DATABASE_URL
    );
  }
  if (spec === 'dev' || spec === 'development') {
    return (
      process.env.DEV_DATABASE_URL ||
      rootEnv.DEV_DATABASE_URL ||
      rootEnv.DATABASE_URL
    );
  }
  return spec;
}

function sha256CanonicalRows(rows) {
  const canonical = JSON.stringify(
    rows.map((r) => {
      const sorted = {};
      for (const k of Object.keys(r).sort()) {
        const val = r[k];
        sorted[k] = val instanceof Date ? val.toISOString() : val;
      }
      return sorted;
    })
  );
  return crypto.createHash('sha256').update(canonical, 'utf8').digest('hex');
}

function quoteIdent(ident) {
  return '"' + String(ident).replace(/"/g, '""') + '"';
}

async function createBackup(sourceSpec) {
  const connectionString = resolveDbUrl(sourceSpec);
  if (!connectionString) {
    throw new Error('Could not resolve database connection string for backup.');
  }

  const client = new Client({
    connectionString,
    ssl: { rejectUnauthorized: false }
  });

  await client.connect();
  try {
    await client.query('BEGIN TRANSACTION READ ONLY');

    // Dynamically discover ALL base tables in public schema
    const tablesRes = await client.query(`
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
      ORDER BY table_name ASC
    `);

    const tableNames = tablesRes.rows.map((r) => r.table_name);
    console.log(`📦 Discovered ${tableNames.length} base tables in public schema: ${tableNames.join(', ')}`);

    const backupData = {
      metadata: {
        createdAt: new Date().toISOString(),
        schema: 'public',
        tableCount: tableNames.length,
        tables: {}
      },
      tables: {}
    };

    for (const tableName of tableNames) {
      // Discover column definitions
      const colsRes = await client.query(
        `
        SELECT
          column_name,
          data_type,
          udt_name,
          character_maximum_length,
          is_nullable,
          column_default,
          ordinal_position
        FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = $1
        ORDER BY ordinal_position ASC
        `,
        [tableName]
      );

      // Discover primary key columns for deterministic row ordering
      const pkRes = await client.query(
        `
        SELECT kcu.column_name
        FROM information_schema.table_constraints tc
        JOIN information_schema.key_column_usage kcu
          ON tc.constraint_name = kcu.constraint_name
         AND tc.table_schema = kcu.table_schema
        WHERE tc.constraint_type = 'PRIMARY KEY'
          AND tc.table_schema = 'public'
          AND tc.table_name = $1
        ORDER BY kcu.ordinal_position ASC
        `,
        [tableName]
      );

      const pkCols = pkRes.rows.map((r) => r.column_name);
      const orderClause = pkCols.length > 0
        ? `ORDER BY ${pkCols.map(quoteIdent).join(', ')} ASC`
        : '';

      const rowsRes = await client.query(`SELECT * FROM public.${quoteIdent(tableName)} ${orderClause}`);
      const rows = rowsRes.rows;
      const checksum = sha256CanonicalRows(rows);

      // Check sequences attached to serial columns
      const sequences = [];
      for (const col of colsRes.rows) {
        const seqRes = await client.query(
          `SELECT pg_get_serial_sequence($1, $2) AS seq_name`,
          [`public.${quoteIdent(tableName)}`, col.column_name]
        );
        const seqName = seqRes.rows[0]?.seq_name;
        if (seqName) {
          const seqState = await client.query(`SELECT last_value, is_called FROM ${seqName}`);
          sequences.push({
            column: col.column_name,
            sequenceName: seqName,
            lastValue: String(seqState.rows[0].last_value),
            isCalled: Boolean(seqState.rows[0].is_called)
          });
        }
      }

      backupData.metadata.tables[tableName] = {
        rowCount: rows.length,
        sha256: checksum,
        primaryKey: pkCols,
        sequences
      };

      backupData.tables[tableName] = {
        columns: colsRes.rows,
        primaryKey: pkCols,
        sequences,
        rows
      };

      console.log(`  ✅ Backed up "${tableName}": ${rows.length} rows (sha256: ${checksum.slice(0, 16)}...)`);
    }

    await client.query('COMMIT');

    const backupsDir = path.join(ROOT_DIR, 'backups');
    fs.mkdirSync(backupsDir, { recursive: true });

    const stamp = new Date().toISOString().replace(/[:.]/g, '-');
    const outFile = path.join(backupsDir, `backup-${sourceSpec || 'prod'}-${stamp}.json`);
    fs.writeFileSync(outFile, JSON.stringify(backupData, null, 2), 'utf8');

    console.log(`\n🎉 Backup written successfully to: ${outFile}`);
    return outFile;
  } finally {
    await client.end();
  }
}

function buildColumnSqlType(col) {
  if (col.data_type === 'character varying') {
    return col.character_maximum_length ? `VARCHAR(${col.character_maximum_length})` : 'TEXT';
  }
  if (col.data_type === 'timestamp with time zone') return 'TIMESTAMPTZ';
  if (col.data_type === 'timestamp without time zone') return 'TIMESTAMP';
  if (col.data_type === 'jsonb') return 'JSONB';
  if (col.data_type === 'json') return 'JSON';
  if (col.data_type === 'boolean') return 'BOOLEAN';
  if (col.data_type === 'integer') return 'INTEGER';
  if (col.data_type === 'bigint') return 'BIGINT';
  if (col.data_type === 'uuid') return 'UUID';
  if (col.data_type === 'text') return 'TEXT';
  return col.udt_name || 'TEXT';
}

async function restoreIntoSchema(backupFile, targetSpec, targetSchema = 'public', dropVerifyAfter = false) {
  const connectionString = resolveDbUrl(targetSpec);
  if (!connectionString) {
    throw new Error('Could not resolve target database connection string.');
  }

  const raw = fs.readFileSync(path.resolve(backupFile), 'utf8');
  const backupData = JSON.parse(raw);

  const client = new Client({
    connectionString,
    ssl: { rejectUnauthorized: false }
  });

  await client.connect();
  try {
    await client.query('BEGIN');

    if (targetSchema !== 'public') {
      await client.query(`DROP SCHEMA IF EXISTS ${quoteIdent(targetSchema)} CASCADE`);
      await client.query(`CREATE SCHEMA ${quoteIdent(targetSchema)}`);
    }

    const tableNames = Object.keys(backupData.tables).sort();
    console.log(`🔄 Restoring ${tableNames.length} tables into schema "${targetSchema}"...`);

    for (const tableName of tableNames) {
      const tbl = backupData.tables[tableName];
      const colDefs = tbl.columns.map((c) => {
        const sqlType = buildColumnSqlType(c);
        const nullable = c.is_nullable === 'NO' ? 'NOT NULL' : '';
        return `${quoteIdent(c.column_name)} ${sqlType} ${nullable}`.trim();
      });

      if (tbl.primaryKey && tbl.primaryKey.length > 0) {
        colDefs.push(`PRIMARY KEY (${tbl.primaryKey.map(quoteIdent).join(', ')})`);
      }

      if (targetSchema === 'public') {
        await client.query(`CREATE TABLE IF NOT EXISTS ${quoteIdent(targetSchema)}.${quoteIdent(tableName)} (${colDefs.join(', ')})`);
        await client.query(`TRUNCATE TABLE ${quoteIdent(targetSchema)}.${quoteIdent(tableName)} CASCADE`);
      } else {
        await client.query(`CREATE TABLE ${quoteIdent(targetSchema)}.${quoteIdent(tableName)} (${colDefs.join(', ')})`);
      }

      const colNames = tbl.columns.map((c) => c.column_name);
      for (const row of tbl.rows) {
        const placeholders = colNames.map((_, idx) => `$${idx + 1}`).join(', ');
        const values = colNames.map((colName) => {
          const colMeta = tbl.columns.find((c) => c.column_name === colName);
          const v = row[colName];
          if (v !== null && v !== undefined && (colMeta?.data_type === 'jsonb' || colMeta?.data_type === 'json')) {
            return typeof v === 'string' ? v : JSON.stringify(v);
          }
          return v;
        });

        await client.query(
          `INSERT INTO ${quoteIdent(targetSchema)}.${quoteIdent(tableName)} (${colNames.map(quoteIdent).join(', ')}) VALUES (${placeholders})`,
          values
        );
      }

      // Verify restored rows & SHA-256 checksum
      const orderClause = tbl.primaryKey && tbl.primaryKey.length > 0
        ? `ORDER BY ${tbl.primaryKey.map(quoteIdent).join(', ')} ASC`
        : '';
      const verifyRes = await client.query(
        `SELECT * FROM ${quoteIdent(targetSchema)}.${quoteIdent(tableName)} ${orderClause}`
      );

      const restoredChecksum = sha256CanonicalRows(verifyRes.rows);
      const expectedMeta = backupData.metadata.tables[tableName];

      if (verifyRes.rows.length !== expectedMeta.rowCount) {
        throw new Error(
          `Row count mismatch on ${tableName}: expected ${expectedMeta.rowCount}, got ${verifyRes.rows.length}`
        );
      }
      if (restoredChecksum !== expectedMeta.sha256) {
        throw new Error(
          `SHA-256 mismatch on ${tableName}: expected ${expectedMeta.sha256}, got ${restoredChecksum}`
        );
      }

      console.log(`  ✅ Verified "${tableName}" in "${targetSchema}": ${verifyRes.rows.length} rows, SHA-256 match (${restoredChecksum.slice(0, 16)}...)`);
    }

    if (dropVerifyAfter && targetSchema !== 'public') {
      await client.query(`DROP SCHEMA ${quoteIdent(targetSchema)} CASCADE`);
      console.log(`🧹 Cleaned up temporary verification schema "${targetSchema}".`);
    }

    await client.query('COMMIT');
    console.log('🎉 Backup restore verification PASSED with 100% table, row-count, and SHA-256 fidelity!');
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    await client.end();
  }
}

async function main() {
  const verifyFile = getArg('--verify-restore');
  const restoreFile = getArg('--restore');
  const source = getArg('--source') || 'prod';
  const target = getArg('--target') || 'dev';

  if (verifyFile) {
    await restoreIntoSchema(verifyFile, target, 'backup_verify_tmp', true);
  } else if (restoreFile) {
    if (target === 'prod' || target === 'production') {
      if (!process.argv.includes('--confirm-production-restore')) {
        throw new Error('Restoring into production requires --confirm-production-restore flag.');
      }
    }
    await restoreIntoSchema(restoreFile, target, 'public', false);
  } else {
    await createBackup(source);
  }
}

main().catch((err) => {
  console.error('❌ Backup/Restore Error:', err.message);
  process.exit(1);
});
