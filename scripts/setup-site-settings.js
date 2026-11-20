const db = require('../lib/db');

async function setup() {
  try {
    await db.query(`
      CREATE TABLE IF NOT EXISTS site_settings (
        key VARCHAR(50) PRIMARY KEY,
        value JSONB NOT NULL,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );
    `);
    console.log('✅ Table "site_settings" created or verified.');

    const existing = await db.query("SELECT * FROM site_settings WHERE key = 'publishing'");
    if (existing.rows.length === 0) {
      const initialSetting = {
        status: 'coming_soon',
        scheduled_at: null,
        updated_at: new Date().toISOString(),
        updated_by: 'info@rockwelltaxdigital.com'
      };
      await db.query(
        "INSERT INTO site_settings (key, value) VALUES ('publishing', $1)",
        [JSON.stringify(initialSetting)]
      );
      console.log('✅ Initialized publishing setting to:', initialSetting);
    } else {
      console.log('ℹ️ Current publishing setting in DB:', existing.rows[0].value);
    }
    process.exit(0);
  } catch (err) {
    console.error('❌ Error setting up site_settings:', err);
    process.exit(1);
  }
}

setup();
