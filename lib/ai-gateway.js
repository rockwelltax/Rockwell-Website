const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const AI_GATEWAY_BASE_URL = process.env.NEON_AI_GATEWAY_BASE_URL;
const AI_GATEWAY_TOKEN = process.env.NEON_AI_GATEWAY_TOKEN;

async function callChatCompletion(messages, model = 'meta-llama/llama-3.1-8b-instruct') {
  if (!AI_GATEWAY_BASE_URL || !AI_GATEWAY_TOKEN) {
    throw new Error('Neon AI Gateway credentials not configured in environment.');
  }

  const endpoint = `${AI_GATEWAY_BASE_URL.replace(/\/+$/, '')}/chat/completions`;
  const response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${AI_GATEWAY_TOKEN}`,
    },
    body: JSON.stringify({
      model,
      messages,
      max_tokens: 150,
    }),
  });

  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.error?.message || data.message || `AI Gateway request failed with status ${response.status}`);
  }

  return data;
}

module.exports = {
  callChatCompletion,
  AI_GATEWAY_BASE_URL,
};
