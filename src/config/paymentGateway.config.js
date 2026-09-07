// config/paymentGateway.config.js
// Central place for all payment provider keys + the ACTIVE deposit gateway.
// Admin anaweza kubadilisha gateway (PalmPesa <-> Snipe) bila kuandika upya code.
const fs = require('fs');
const path = require('path');

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
    return { ok: false, error: `Invalid gateway "${gateway}". Chagua palmpesa au snipe.` };
  }
  cached = { active: key };
  const persisted = writeSettings(cached);
  return { ok: persisted, active: key };
}

function getProvider(key) {
  return PROVIDERS[key] || null;
}

module.exports = {
  PROVIDERS,
  DEFAULT_GATEWAY,
  getActiveGateway,
  setActiveGateway,
  getProvider,
};