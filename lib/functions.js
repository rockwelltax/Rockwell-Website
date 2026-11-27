const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const FUNCTION_HOST_SUFFIX = process.env.NEON_FUNCTION_HOST_SUFFIX;
const BRANCH_ID = process.env.NEON_BRANCH_ID;

function getFunctionUrl(functionName) {
  if (!BRANCH_ID || !FUNCTION_HOST_SUFFIX) {
    return null;
  }
  const suffix = FUNCTION_HOST_SUFFIX.startsWith('.') ? FUNCTION_HOST_SUFFIX : `.${FUNCTION_HOST_SUFFIX}`;
  return `https://${BRANCH_ID}-${functionName}${suffix}`;
}

async function invokeFunction(functionName, subpath = '', options = {}) {
  const base = getFunctionUrl(functionName);
  if (!base) throw new Error('Neon Function configuration not found in environment.');
  const url = subpath ? `${base.replace(/\/+$/, '')}/${subpath.replace(/^\/+/, '')}` : base;
  const res = await fetch(url, options);
  return res;
}

module.exports = {
  getFunctionUrl,
  invokeFunction,
};
