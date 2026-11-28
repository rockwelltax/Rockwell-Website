const fs = require('fs');
const path = require('path');
const JavaScriptObfuscator = require('javascript-obfuscator');

const ROOT_DIR = path.resolve(__dirname, '..');
const ROCKWELL_DIR = path.resolve(ROOT_DIR, 'rockwell-website');
const SOURCE_BACKUP_DIR = path.resolve(ROOT_DIR, '_source_clean');

const CLIENT_JS_FILES = [
  'index.js',
  'js/animations.js',
  'js/form-validation.js',
  'js/navigation.js',
  'js/site-guard.js',
  'js/utilities.js',
  'pages/about/about.js',
  'pages/admin/admin.js',
  'pages/bookkeeping/bookkeeping.js',
  'pages/coming-soon/coming-soon.js',
  'pages/contact/contact.js',
  'pages/digital-services/digital-services.js',
  'pages/services/services.js',
  'pages/start-your-tax-return/start-your-tax-return.js',
  'pages/tax-preparation/tax-preparation.js'
];

const OBFUSCATOR_OPTIONS = {
  compact: true,
  controlFlowFlattening: true,
  controlFlowFlatteningThreshold: 0.75,
  deadCodeInjection: false,
  debugProtection: true, // Anti-Debugging: freezes and loops debugger if DevTools Sources tab is inspected
  debugProtectionInterval: 2000,
  disableConsoleOutput: true, // Mutes and wipes console output in DevTools
  identifierNamesGenerator: 'hexadecimal',
  log: false,
  numbersToExpressions: true,
  renameGlobals: false,
  selfDefending: false,
  simplify: true,
  splitStrings: true,
  splitStringsChunkLength: 5,
  stringArray: true,
  stringArrayCallsTransform: true,
  stringArrayCallsTransformThreshold: 0.75,
  stringArrayEncoding: ['base64'],
  stringArrayIndexShift: true,
  stringArrayRotate: true,
  stringArrayShuffle: true,
  stringArrayWrappersCount: 2,
  stringArrayWrappersChainedCalls: true,
  stringArrayWrappersParametersMaxCount: 4,
  stringArrayWrappersType: 'function',
  stringArrayThreshold: 0.85,
  target: 'browser',
  unicodeEscapeSequence: false,
  sourceMap: false
};

const BANNER = '/* Rockwell Tax & Digital Strategies Inc. - Protected Intellectual Property. Unauthorized copying or redistribution is strictly prohibited. */\n';

async function main() {
  console.log('🔒 Rockwell Source Code Protection & Encryption Builder');
  console.log('══════════════════════════════════════════════════════════');

  // Step 1: Ensure clean source backup exists
  if (!fs.existsSync(SOURCE_BACKUP_DIR)) {
    fs.mkdirSync(SOURCE_BACKUP_DIR, { recursive: true });
    console.log(`📁 Created clean source directory: ${SOURCE_BACKUP_DIR}`);
  }

  for (const rel of CLIENT_JS_FILES) {
    const srcFile = path.join(ROOT_DIR, rel);
    const backupFile = path.join(SOURCE_BACKUP_DIR, rel);

    // If backup does not exist, copy current clean file to backup
    if (!fs.existsSync(backupFile)) {
      if (fs.existsSync(srcFile)) {
        fs.mkdirSync(path.dirname(backupFile), { recursive: true });
        fs.copyFileSync(srcFile, backupFile);
        console.log(`💾 Preserved clean source: ${rel}`);
      }
    }
  }

  // Step 2: Obfuscate each file from _source_clean and deploy to both root and rockwell-website
  console.log('\n🔐 Encrypting & Obfuscating Client-Facing Scripts...');

  let count = 0;
  for (const rel of CLIENT_JS_FILES) {
    const cleanSourcePath = path.join(SOURCE_BACKUP_DIR, rel);
    if (!fs.existsSync(cleanSourcePath)) {
      console.warn(`⚠️ Warning: Source not found for ${rel}`);
      continue;
    }

    const cleanCode = fs.readFileSync(cleanSourcePath, 'utf8');

    try {
      const obfResult = JavaScriptObfuscator.obfuscate(cleanCode, OBFUSCATOR_OPTIONS);
      const encryptedCode = BANNER + obfResult.getObfuscatedCode();

      // Destination 1: Root
      const destRoot = path.join(ROOT_DIR, rel);
      fs.mkdirSync(path.dirname(destRoot), { recursive: true });
      fs.writeFileSync(destRoot, encryptedCode, 'utf8');

      // Destination 2: rockwell-website (only if separate subfolder exists)
      if (ROCKWELL_DIR !== ROOT_DIR && fs.existsSync(ROCKWELL_DIR)) {
        const destRockwell = path.join(ROCKWELL_DIR, rel);
        fs.mkdirSync(path.dirname(destRockwell), { recursive: true });
        fs.writeFileSync(destRockwell, encryptedCode, 'utf8');
      }

      console.log(`  ✅ Encrypted & deployed: ${rel}`);
      count++;
    } catch (err) {
      console.error(`  ❌ Error obfuscating ${rel}:`, err.message);
    }
  }

  console.log(`\n🎉 Successfully encrypted ${count} JavaScript files!`);
  console.log('ℹ️ Inspect element remains 100% functional. Sources tab will now show encrypted hex-encoded bytecode.');
}

main().catch(err => {
  console.error('Fatal error during build:', err);
  process.exit(1);
});
