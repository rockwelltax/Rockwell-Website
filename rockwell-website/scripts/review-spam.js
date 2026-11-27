#!/usr/bin/env node
/**
 * Rockwell Tax & Digital Strategies Inc.
 * Production Inquiry Spam Classification & Safe Non-Destructive Quarantine Utility
 *
 * Usage:
 *   node scripts/review-spam.js --dry-run
 *   node scripts/review-spam.js --execute-archive
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

const KNOWN_INTERNAL_TEST_IPS = new Set([
  '120.29.68.176',
  '127.0.0.1',
  '::1',
  '112.208.181.185'
]);

function classifyRow(r) {
  const msg = String(r.details?.message || '');
  const isPairedBotSignature =
    /^[A-Z][a-z]{4,10}$/.test(r.name || '') &&
    (/^\d{10}$/.test(msg) ||
      (r.details?.w2Count === '7+' &&
       r.details?.filingStatus === 'not-sure' &&
       r.details?.selfEmployed === 'not-sure' &&
       r.details?.otherIncome === 'not-sure'));

  const isInternalTester = KNOWN_INTERNAL_TEST_IPS.has(r.ip_address);

  if (isPairedBotSignature && !isInternalTester) {
    return 'confirmed_spam';
  }
  if (isInternalTester) {
    return 'internal_test';
  }
  return 'legitimate_or_uncertain';
}

async function main() {
  const executeArchive = process.argv.includes('--execute-archive');
  const connectionString =
    process.env.MIGRATION_DATABASE_URL ||
    rootEnv.MIGRATION_DATABASE_URL ||
    subEnv.DATABASE_URL;

  if (!connectionString) {
    throw new Error('Could not resolve production MIGRATION_DATABASE_URL.');
  }

  const client = new Client({
    connectionString,
    ssl: { rejectUnauthorized: false }
  });

  await client.connect();
  try {
    const res = await client.query('SELECT * FROM inquiries ORDER BY id ASC');
    const grouped = {
      confirmed_spam: [],
      internal_test: [],
      legitimate_or_uncertain: []
    };

    for (const row of res.rows) {
      grouped[classifyRow(row)].push(row);
    }

    console.log('📊 Inquiry Classification Report');
    console.log('════════════════════════════════════════════════════');
    console.log(`  Total Records          : ${res.rows.length}`);
    console.log(`  Confirmed Bot Spam     : ${grouped.confirmed_spam.length}`);
    console.log(`  Internal QA / Seed     : ${grouped.internal_test.length}`);
    console.log(`  Legitimate / Uncertain : ${grouped.legitimate_or_uncertain.length}`);

    if (!executeArchive) {
      console.log('\nℹ️ Dry-run complete. No records were modified.');
      return;
    }

    const spamIds = grouped.confirmed_spam
      .filter((r) => r.status !== 'spam_archived')
      .map((r) => r.id);

    if (spamIds.length === 0) {
      console.log('\nℹ️ All confirmed spam entries are already archived.');
      return;
    }

    await client.query('BEGIN');
    const updateRes = await client.query(
      `UPDATE inquiries
       SET status = 'spam_archived', updated_at = NOW()
       WHERE id = ANY($1::int[])
       RETURNING id`,
      [spamIds]
    );

    // Record audit trail if security_audit_logs exists
    const auditTableCheck = await client.query(
      `SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'security_audit_logs'`
    );
    if (auditTableCheck.rows.length > 0) {
      await client.query(
        `INSERT INTO security_audit_logs (event_type, severity, actor_email, target_type, metadata)
         VALUES ($1, $2, $3, $4, $5)`,
        [
          'spam_bulk_archived',
          'info',
          'system-migration',
          'inquiries',
          JSON.stringify({ archivedCount: updateRes.rowCount, archivedIds: spamIds })
        ]
      );
    }

    await client.query('COMMIT');
    console.log(`\n✅ Non-destructively archived ${updateRes.rowCount} confirmed spam records (status = 'spam_archived').`);
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    throw err;
  } finally {
    await client.end();
  }
}

main().catch((err) => {
  console.error('❌ Review Spam Error:', err.message);
  process.exit(1);
});
