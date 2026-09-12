// config/paymentGateway.config.js
// Central place for all payment provider keys + the ACTIVE deposit gateway.
// Admin anaweza kubadilisha gateway (PalmPesa <-> Snipe <-> AnyPay) bila kuandika upya code.
// API keys zimehifadhiwa kwenye DATABASE (table 'api_keys') na ku-seed kutoka
// defaults hapa mara ya kwanza server inapoanza. Uki-zibadilisha via admin,
// zinahifadhiwa kwenye DB na kutumika mara moja (bila restart).
const fs = require('fs');
const path = require('path');
const apiKeyRepository = require('../repositories/apiKey/apiKey.repository');

const PROVIDERS = {
  palmpesa: {
    name: 'PalmPesa',
    apiToken: 'jZlFqyRsdNPN2J0ppVtYlathfbzUB3jZQNihMXi2NaublB5Xi93R97IxM98T',
    userId: '1083',
    baseUrl: 'https://palmpesa.drmlelwa.co.tz',
  },
  snipe: {
    name: 'Snipe',
    apiKey: 'snp_b0c2ed1711e20a8951538a7814fb9eb15e59a73c0c0b45cfdc0f0ca4eecef498',
    baseUrl: 'https://api.snippe.sh/v1',
  },
  anypay: {
    name: 'AnyPay',
    apiKey: 'wq_live_X_YlPf0uyqEKI0MlLt4zi6gdOAP3F1kcTmiN_-LQukU',
    baseUrl: 'https://anypaytanzania.com',
  },
};

// Fields zinazoweza kuhaririwa (kuhifadhiwa DB) kwa kila provider.
const CREDENTIAL_FIELDS = {
  palmpesa: ['apiToken', 'userId', 'baseUrl'],
  snipe: ['apiKey', 'baseUrl'],
  anypay: ['apiKey', 'baseUrl'],
};

const DEFAULT_GATEWAY = 'palmpesa';
const SETTINGS_PATH = path.join(__dirname, 'paymentGateway.settings.json');

function readSettings() {
  try {
    if (fs.existsSync(SETTINGS_PATH)) {
      const data = JSON.parse(fs.readFileSync(SETTINGS_PATH, 'utf8'));
      if (data && PROVIDERS[data.active]) return { active: data.active };
    }
  } catch (e) {
    console.warn('[PAYMENT GATEWAY] read settings failed:', e.message);
  }
  return { active: DEFAULT_GATEWAY };
}

function writeSettings(settings) {
  try {
    fs.writeFileSync(SETTINGS_PATH, JSON.stringify(settings, null, 2), 'utf8');
    return true;
  } catch (e) {
    console.error('[PAYMENT GATEWAY] write settings failed:', e.message);
    return false;
  }
}

// In-memory cache - server inasoma file mara ya kwanza tu.
let cached = readSettings();

function getActiveGateway() {
  return cached.active;
}

function setActiveGateway(gateway) {
  const key = String(gateway || '').trim().toLowerCase();
  if (!PROVIDERS[key]) {
    return { ok: false, error: `Invalid gateway "${gateway}". Chagua palmpesa, snipe au anypay.` };
  }
  cached = { active: key };
  const persisted = writeSettings(cached);
  return { ok: persisted, active: key };
}

function getProvider(key) {
  return PROVIDERS[key] || null;
}

// Load provider credentials kutoka DB (fallback = defaults za config).
// Hii inamutate PROVIDERS in-memory, hivyo money.service's PALMPESA/SNIPPE
// references zinabaki kuwa live bila kuvunjika.
async function seedProviderCredentials() {
  try {
    for (const gateway of Object.keys(PROVIDERS)) {
      const defaults = { ...PROVIDERS[gateway] };
      const row = await apiKeyRepository.findByGateway(gateway);
      if (row && row.credentials && typeof row.credentials === 'object') {
        Object.assign(PROVIDERS[gateway], row.credentials);
        console.log(`[API KEY] ${gateway} loaded from DB`);
      } else {
        await apiKeyRepository.upsertCredentials(gateway, defaults);
        console.log(`[API KEY] ${gateway} seeded from defaults into DB`);
      }
    }
  } catch (e) {
    console.warn('[API KEY] seed failed (server inaendelea na defaults):', e.message);
  }
}

// Returns current credentials (full) kwa ajili ya admin editing UI.
function getProviderCredentials() {
  const all = {};
  for (const key of Object.keys(PROVIDERS)) {
    all[key] = { ...PROVIDERS[key] };
  }
  return all;
}

// Update & persist provider API keys kwenye DB. Ina-update PROVIDERS mara moja.
async function updateProviderCredentials(gateway, updates = {}) {
  const key = String(gateway || '').trim().toLowerCase();
  if (!PROVIDERS[key]) {
    return { ok: false, error: `Invalid gateway "${gateway}". Chagua palmpesa, snipe au anypay.` };
  }

  const allowed = CREDENTIAL_FIELDS[key] || [];
  const changes = {};
  for (const field of allowed) {
    if (typeof updates[field] === 'string' && updates[field].trim() !== '') {
      PROVIDERS[key][field] = updates[field].trim();
      changes[field] = updates[field].trim();
    }
  }

  if (Object.keys(changes).length === 0) {
    return { ok: false, error: 'Hakuna keys sahihi zilizotumwa za kusasisha.' };
  }

  try {
    await apiKeyRepository.upsertCredentials(key, changes);
  } catch (e) {
    console.error('[API KEY] persist failed:', e.message);
    return { ok: false, error: 'Imeshindikana kuokoa keys kwenye database: ' + e.message };
  }

  return { ok: true, changed: Object.keys(changes) };
}

module.exports = {
  PROVIDERS,
  DEFAULT_GATEWAY,
  CREDENTIAL_FIELDS,
  getActiveGateway,
  setActiveGateway,
  getProvider,
  seedProviderCredentials,
  getProviderCredentials,
  updateProviderCredentials,
};