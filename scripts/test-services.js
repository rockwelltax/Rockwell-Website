const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
const db = require('../lib/db');
const { uploadFile, getPresignedUrl } = require('../lib/storage');
const { invokeFunction, getFunctionUrl } = require('../lib/functions');

async function testServices() {
  console.log('========================================');
  console.log('🧪 Starting Neon End-to-End Service Tests');
  console.log('========================================\n');
  const results = {};

  // 1. Lakebase Postgres Database
  try {
    process.stdout.write('1. Testing Lakebase Postgres Database... ');
    const res = await db.query('SELECT NOW() as now, version() as version');
    const tableRes = await db.query("SELECT COUNT(*) as count FROM information_schema.tables WHERE table_schema = 'public'");
    console.log('✅ PASSED');
    console.log(`   - Server Time: ${res.rows[0].now}`);
    console.log(`   - Public Tables: ${tableRes.rows[0].count}`);
    results.postgres = true;
  } catch (err) {
    console.log('❌ FAILED:', err.message);
    results.postgres = false;
  }

  // 2. Neon Functions
  try {
    process.stdout.write('\n2. Testing Neon Functions (hello)... ');
    const fnUrl = getFunctionUrl('hello');
    const res = await invokeFunction('hello');
    const text = await res.text();
    if (res.status === 200 && text.includes('Hello from Neon Functions')) {
      console.log('✅ PASSED');
      console.log(`   - Function URL: ${fnUrl}`);
      console.log(`   - Response: "${text.trim()}"`);
      results.functions = true;
    } else {
      console.log('❌ FAILED: Unexpected response status:', res.status, text);
      results.functions = false;
    }
  } catch (err) {
    console.log('❌ FAILED:', err.message);
    results.functions = false;
  }

  // 3. Neon Object Storage
  try {
    process.stdout.write('\n3. Testing Neon Object Storage (assets bucket)... ');
    const testKey = `test/ping-${Date.now()}.txt`;
    await uploadFile(testKey, 'Neon Object Storage Test Payload', 'text/plain');
    const presigned = await getPresignedUrl(testKey, 300);
    const fetchRes = await fetch(presigned);
    const fetchedText = await fetchRes.text();
    if (fetchRes.status === 200 && fetchedText === 'Neon Object Storage Test Payload') {
      console.log('✅ PASSED');
      console.log(`   - Uploaded: ${testKey}`);
      console.log(`   - Verified presigned GET: 200 OK (${fetchedText})`);
      results.storage = true;
    } else {
      console.log('❌ FAILED: Fetched status:', fetchRes.status);
      results.storage = false;
    }
  } catch (err) {
    console.log('❌ FAILED:', err.message);
    results.storage = false;
  }

  // 4. Neon Auth JWKS
  try {
    process.stdout.write('\n4. Testing Neon Auth JWKS Endpoint... ');
    const jwksUrl = process.env.NEON_AUTH_JWKS_URL;
    const res = await fetch(jwksUrl);
    const data = await res.json();
    if (res.status === 200 && Array.isArray(data.keys)) {
      console.log('✅ PASSED');
      console.log(`   - JWKS URL: ${jwksUrl}`);
      console.log(`   - Keys available: ${data.keys.length}`);
      results.auth = true;
    } else {
      console.log('❌ FAILED: Invalid response:', res.status);
      results.auth = false;
    }
  } catch (err) {
    console.log('❌ FAILED:', err.message);
    results.auth = false;
  }

  // 5. Neon AI Gateway
  try {
    process.stdout.write('\n5. Testing Neon AI Gateway Configuration... ');
    const baseUrl = process.env.NEON_AI_GATEWAY_BASE_URL;
    const token = process.env.NEON_AI_GATEWAY_TOKEN;
    if (baseUrl && token) {
      console.log('✅ PASSED (Configured)');
      console.log(`   - Base URL: ${baseUrl}`);
      results.aiGateway = true;
    } else {
      console.log('⚠️ NOT CONFIGURED');
      results.aiGateway = false;
    }
  } catch (err) {
    console.log('❌ FAILED:', err.message);
    results.aiGateway = false;
  }

  console.log('\n========================================');
  console.log('Summary of Results:');
  for (const [service, passed] of Object.entries(results)) {
    console.log(`  - ${service.padEnd(15)}: ${passed ? '✅ SUCCESS' : '❌ FAILED'}`);
  }
  console.log('========================================\n');

  // Close db pool
  await db.pool.end();
}

testServices();
