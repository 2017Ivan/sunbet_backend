// config/paymentGateway.config.js
// Central place for all payment provider keys + the ACTIVE deposit gateway.
// Admin anaweza kubadilisha gateway (DaliPay <-> PalmPesa <-> Snipe <-> AnyPay) bila kuandika upya code.
// Server inapowaka upya, gateway hurudi kwenye DEFAULT_GATEWAY (dalipay).
// API keys zimehifadhiwa kwenye DATABASE (table 'api_keys') na ku-seed kutoka
// defaults hapa mara ya kwanza server inapoanza. Uki-zibadilisha via admin,
// zinahifadhiwa kwenye DB na kutumika mara moja (bila restart).
const fs = require('fs');
const path = require('path');
const apiKeyRepository = require('../repositories/apiKey/apiKey.repository');

const PROVIDERS = {
  dalipay: {
    name: 'DaliPay',
    publicKey: 'gw_pk_production_tX9biqj9dRpXZmtXSBz4V3nT36R1_nsW',
    secretKey: 'gw_sk_production_1w4dVWarzdFWqi2_bJ4uD_BecTV4t24YsmInjgQ5P8',
    callbackSecret: 'TDEaFvoSCeOuSjo8mLcjElJ0RHLh7yqikQiG5pKT1V8',
    baseUrl: 'https://app.dalipay.co.tz/api/v1',
  },
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
    apiKey: 'wq_live_WshYJtAxHJralYNMyYPz_-TV6Q49Jj-urIJll5GKNDE',
    baseUrl: 'https://anypaytanzania.com',
  },
};

// Fields zinazoweza kuhaririwa (kuhifadhiwa DB) kwa kila provider.
const CREDENTIAL_FIELDS = {
  dalipay: ['publicKey', 'secretKey', 'callbackSecret', 'baseUrl'],
  palmpesa: ['apiToken', 'userId', 'baseUrl'],
  snipe: ['apiKey', 'baseUrl'],
  anypay: ['apiKey', 'baseUrl'],
};

const DEFAULT_GATEWAY = 'dalipay';
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

// In-memory cache - server inapowaka upya HURUDI kwenye DEFAULT_GATEWAY
// (dalipay). Admin bado anaweza kubadilisha gateway wakati server ikiwa
// inafanya kazi; mabadiliko hayo hureset pale server inaporestart.
let cached = { active: DEFAULT_GATEWAY };

function getActiveGateway() {
  return cached.active;
}

function setActiveGateway(gateway) {
  const key = String(gateway || '').trim().toLowerCase();
  if (!PROVIDERS[key]) {
    return { ok: false, error: `Invalid gateway "${gateway}". Chagua dalipay, palmpesa, snipe au anypay.` };
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
        // DB values take precedence, lakini tusiruhusu value tupu kutoka DB
        // kufuta default mpya kwenye config. Hii inasaidia pale default
        // mpya (mfano callbackSecret) inaongezwa baada ya DB kufanyiwa seed.
        const merged = { ...defaults };
        for (const [k, v] of Object.entries(row.credentials)) {
          if (v !== '' && v !== null && v !== undefined) merged[k] = v;
        }

        // Migration: API ya DaliPay iko app.dalipay.co.tz (sio domain ya
        // dashboard dalipay.co.tz). Rekebisha base URL ya zamani iliyokwisha
        // seed kwenye DB ili deposits zisipate 404.
        if (gateway === 'dalipay' && merged.baseUrl === 'https://dalipay.co.tz/api/v1') {
          merged.baseUrl = defaults.baseUrl;
        }

        Object.assign(PROVIDERS[gateway], merged);

        // Sasisha DB na defaults zozote mpya zilizojazwa ili admin panel
        // ionyeshe values sahihi bila kuhitaji update ya mkono.
        const changes = {};
        for (const [k, v] of Object.entries(merged)) {
          if (row.credentials[k] !== v) changes[k] = v;
        }
        if (Object.keys(changes).length > 0) {
          await apiKeyRepository.upsertCredentials(gateway, changes);
        }
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
    return { ok: false, error: `Invalid gateway "${gateway}". Chagua dalipay, palmpesa, snipe au anypay.` };
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