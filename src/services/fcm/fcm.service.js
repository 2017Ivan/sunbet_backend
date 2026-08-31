// services/fcm/fcm.service.js
// Firebase Cloud Messaging (push notifications) via firebase-admin.
//
// Credentials are read from env:
//   FIREBASE_SERVICE_ACCOUNT_PATH  -> path to the downloaded service account JSON
//   (or) FIREBASE_SERVICE_ACCOUNT_B64 -> base64 of that same JSON
//
// If neither is set, FCM is DISABLED (no crash) so the backend keeps running
// until the credentials are added.

const fs = require('fs');
const { initializeApp: initializeFirebaseApp, cert } = require('firebase-admin/app');
const { getMessaging } = require('firebase-admin/messaging');

let initialized = false;
let enabled = false;

const getServiceAccount = () => {
  const envPath = process.env.FIREBASE_SERVICE_ACCOUNT_PATH;
  if (envPath && fs.existsSync(envPath)) {
    return JSON.parse(fs.readFileSync(envPath, 'utf8'));
  }
  const b64 = process.env.FIREBASE_SERVICE_ACCOUNT_B64;
  if (b64) {
    return JSON.parse(Buffer.from(b64, 'base64').toString('utf8'));
  }
  return null;
};

const initFcm = () => {
  if (initialized) return enabled;
  initialized = true;

  try {
    const serviceAccount = getServiceAccount();
    if (!serviceAccount) {
      console.log('⚠️  FCM disabled — add FIREBASE_SERVICE_ACCOUNT_PATH or FIREBASE_SERVICE_ACCOUNT_B64 to .env');
      return false;
    }
    initializeFirebaseApp({ credential: cert(serviceAccount) });
    enabled = true;
    console.log('🔔 FCM initialized (push notifications ENABLED)');
    return true;
  } catch (err) {
    console.error('❌ FCM initialization failed:', err.message);
    return false;
  }
};

const isEnabled = () => {
  if (!initialized) initFcm();
  return enabled;
};

/**
 * Send a push notification to one FCM device token.
 * @param {string} token
 * @param {{title, message, data}} payload  data keys must be strings
 */
const pushToToken = async (token, { title, message, data = {} }) => {
  if (!isEnabled()) return { attempted: false };
  if (!token) return { attempted: false };

  try {
    const dataPayload = {};
    Object.entries(data).forEach(([k, v]) => {
      dataPayload[k] = v == null ? '' : String(v);
    });

    const res = await getMessaging().send({
      token,
      notification: { title: title || 'SunBet', body: message || '' },
      data: dataPayload,
      android: {
        priority: 'high',
        notification: { channel_id: 'high_importance', priority: 'high', sound: 'default' },
      },
    });
    return { attempted: true, ok: true, messageId: res };
  } catch (err) {
    // Invalid/unregistered token -> caller can remove the device row.
    return { attempted: true, ok: false, code: err.code, message: err.message };
  }
};

/**
 * Send a push to many tokens at once (fire-and-forget).
 */
const pushToTokens = (tokens, payload) => {
  if (!tokens || tokens.length === 0) return Promise.resolve([]);
  return Promise.allSettled(tokens.map((t) => pushToToken(t, payload)));
};

module.exports = {
  initFcm,
  isEnabled,
  pushToToken,
  pushToTokens,
};