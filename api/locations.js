const { Country, State, City } = require('country-state-city');

const PRIORITY_COUNTRY_CODES = ['US', 'PH', 'CA', 'GB', 'AU', 'AE', 'SG'];

let cachedCountries = null;
let cachedPhProvinces = null;
const cachedPhCities = new Map();

function getCountriesPayload() {
  if (cachedCountries) return cachedCountries;

  const all = Country.getAllCountries()
    .map((c) => ({ code: c.isoCode, name: c.name }))
    .sort((a, b) => a.name.localeCompare(b.name));

  const priority = PRIORITY_COUNTRY_CODES
    .map((code) => all.find((c) => c.code === code))
    .filter(Boolean);

  cachedCountries = { priority, all };
  return cachedCountries;
}

async function getPhProvinces() {
  if (cachedPhProvinces) return cachedPhProvinces;
  try {
    const res = await fetch('https://psgc.gitlab.io/api/provinces.json');
    if (res.ok) {
      const data = await res.json();
      if (Array.isArray(data) && data.length > 0) {
        const list = [
          { code: 'NCR', name: 'Metro Manila (NCR)' },
          ...data.map((p) => ({ code: String(p.code), name: String(p.name) }))
        ].sort((a, b) => a.name.localeCompare(b.name));
        cachedPhProvinces = list;
        return list;
      }
    }
  } catch (_) {}

  // Offline fallback via country-state-city
  return State.getStatesOfCountry('PH')
    .map((s) => ({ code: s.isoCode, name: s.name }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

async function getPhCities(stateCode) {
  if (cachedPhCities.has(stateCode)) {
    return cachedPhCities.get(stateCode);
  }

  try {
    let url = null;
    if (stateCode === 'NCR') {
      url = 'https://psgc.gitlab.io/api/regions/130000000/cities-municipalities.json';
    } else if (/^\d{9}$/.test(stateCode)) {
      url = `https://psgc.gitlab.io/api/provinces/${stateCode}/cities-municipalities.json`;
    }

    if (url) {
      const res = await fetch(url);
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data)) {
          const names = Array.from(
            new Set(data.map((c) => String(c.name || '').trim()).filter(Boolean))
          ).sort((a, b) => a.localeCompare(b));
          cachedPhCities.set(stateCode, names);
          return names;
        }
      }
    }
  } catch (_) {}

  return Array.from(
    new Set(City.getCitiesOfState('PH', stateCode).map((c) => c.name))
  ).sort((a, b) => a.localeCompare(b));
}

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Cache-Control', 'public, max-age=86400, s-maxage=604800');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  const type = String(req.query?.type || 'countries').toLowerCase();
  const country = String(req.query?.country || '').trim().toUpperCase();
  const state = String(req.query?.state || '').trim();

  try {
    if (type === 'countries') {
      return res.status(200).json({ success: true, ...getCountriesPayload() });
    }

    if (type === 'states') {
      if (!/^[A-Z]{2}$/.test(country)) {
        return res.status(400).json({ error: 'Valid 2-letter country code required.' });
      }

      if (country === 'PH') {
        const states = await getPhProvinces();
        return res.status(200).json({ success: true, states });
      }

      const states = State.getStatesOfCountry(country)
        .map((s) => ({ code: s.isoCode, name: s.name }))
        .sort((a, b) => a.name.localeCompare(b.name));

      return res.status(200).json({ success: true, states });
    }

    if (type === 'cities') {
      if (!/^[A-Z]{2}$/.test(country)) {
        return res.status(400).json({ error: 'Valid 2-letter country code required.' });
      }

      if (country === 'PH' && state && state !== 'NONE') {
        const cities = await getPhCities(state);
        return res.status(200).json({ success: true, cities });
      }

      const rawCities =
        state && state !== 'NONE'
          ? City.getCitiesOfState(country, state)
          : City.getCitiesOfCountry(country);

      const cities = Array.from(
        new Set((rawCities || []).map((c) => String(c.name || '').trim()).filter(Boolean))
      ).sort((a, b) => a.localeCompare(b));

      return res.status(200).json({ success: true, cities });
    }

    return res.status(400).json({ error: 'Invalid location query type.' });
  } catch (err) {
    console.error('Locations API error:', err.message);
    return res.status(500).json({ error: 'Unable to load location list.' });
  }
};
