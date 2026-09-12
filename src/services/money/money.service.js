// services/money/money.service.js
// Consolidated money service for SunBet.
//
// - Deposit via PalmPesa: initiates an M-Pesa payment; on the PalmPesa webhook
//   the user's balance is credited AUTOMATICALLY (no admin accept needed).
//   A DepositRequest row is kept for history and auto-confirmed on payment.
//   Admins receive a READ-ONLY notification - there is no accept/cancel.
// - Deposit via Snipe: same behaviour but through the Snipe mobile-money API.
// - Deposit via AnyPay: same behaviour through the AnyPay wallet pull API.
// - The ACTIVE deposit gateway (PalmPesa <-> Snipe <-> AnyPay) is switchable from
//   the admin panel - admin picks whichever provider is currently reliable.
// - Withdraw: deducts the balance from the database IMMEDIATELY when the user
//   clicks withdraw. No notification is sent.
//   Withdraw does NOT hit any gateway — it operates directly on the database.

const { sequelize, User, Transaction, DepositRequest, WithdrawRequest } = require('../../models');
const userRepository = require('../../repositories/user/user.repository');
const notificationService = require('../notification/notification.service');
const CustomExceptions = require('../../middleware/CustomExceptions');
const responseBuilder = require('../../utils/response.builder');
const {
  getActiveGateway,
  setActiveGateway,
  getProvider,
  PROVIDERS,
  getProviderCredentials,
  updateProviderCredentials,
} = require('../../config/paymentGateway.config');
const axios = require('axios');
const crypto = require('crypto');
const cron = require('node-cron');

// ============ PROVIDER CONFIGURATION (keys zote pamoja) ============
const PALMPESA = getProvider('palmpesa');
const SNIPPE = getProvider('snipe');
const ANYPAY = getProvider('anypay');

// Random Tanzanian names & regions so every PalmPesa deposit looks unique
// (avoids PalmPesa flagging identical payer profiles).
const FIRST_NAMES = [
  'James', 'John', 'Peter', 'Michael', 'David', 'George', 'Daniel', 'Joseph',
  'Emmanuel', 'Baraka', 'Godfrey', 'Neema', 'Grace', 'Aisha', 'Zainabu', 'Rehema',
  'Halima', 'Mariam', 'Asha', 'Fatuma', 'Salma', 'Amina', 'Imani', 'Baraka',
  'Erick', 'Frank', 'Charles', 'Paul', 'Stephen', 'Alex', 'Samson', 'Benson',
];

const LAST_NAMES = [
  'Mwakalinga', 'Mushi', 'Mkumbo', 'Massawe', 'Mrema', 'Msaky', 'Komba',
  'Swai', 'Kimaro', 'Mrema', 'Mrosso', 'Lema', 'Mrema', 'Mmari', 'Mollel',
  'Kessy', 'Mangana', 'Mwaipopo', 'Nchimbi', 'Mwakasege', 'Mushi', 'Tarimo',
  'Lyimo', 'Mokomba', 'Shirima', 'Msuya', 'Temba', 'Mahenge', 'Mdoe', 'Sanga',
];

// Region -> [address, postcode] pairs for plausible random Tanzanian addresses.
const REGIONS = [
  ['Dar es Salaam', '11111'],
  ['Dar es Salaam', '14101'],
  ['Dar es Salaam', '14105'],
  ['Arusha', '23101'],
  ['Arusha', '23104'],
  ['Mwanza', '33101'],
  ['Mwanza', '33107'],
  ['Dodoma', '41101'],
  ['Dodoma', '41108'],
  ['Tanga', '21101'],
  ['Tanga', '21106'],
  ['Morogoro', '67101'],
  ['Morogoro', '67111'],
  ['Mbeya', '53101'],
  ['Mbeya', '53108'],
  ['Kilimanjaro', '25101'],
  ['Kilimanjaro', '25104'],
  ['Iringa', '51101'],
  ['Iringa', '51108'],
  ['Tabora', '45101'],
  ['Tabora', '45104'],
  ['Pwani', '61101'],
  ['Pwani', '61401'],
  ['Kigoma', '47101'],
  ['Kigoma', '47103'],
  ['Shinyanga', '37101'],
  ['Shinyanga', '37105'],
  ['Mara', '31101'],
  ['Mara', '31103'],
  ['Rukwa', '51101'],
  ['Ruvuma', '57101'],
  ['Lindi', '65101'],
  ['Lindi', '65103'],
  ['Mtwara', '63101'],
  ['Mtwara', '63105'],
  ['Geita', '30101'],
  ['Songwe', '53101'],
];

const pickRandom = (arr) => arr[Math.floor(Math.random() * arr.length)];

// Build a randomized payer identity for a PalmPesa deposit.
function buildPayerProfile() {
  const first = pickRandom(FIRST_NAMES);
  const last = pickRandom(LAST_NAMES);
  const [region, postcode] = pickRandom(REGIONS);
  return {
    name: `${first} ${last}`,
    email: `${first.toLowerCase()}${last.toLowerCase()}@gmail.com`,
    address: region,
    postcode,
  };
}

// In-memory store of pending PalmPesa transactions keyed by our transaction_id.
if (!global.palmPesaTransactions) {
  global.palmPesaTransactions = new Map();
}

// In-memory store of pending Snipe transactions keyed by our transaction_id.
if (!global.snipeTransactions) {
  global.snipeTransactions = new Map();
}

// In-memory store of pending AnyPay transactions keyed by our transaction_id.
if (!global.anypayTransactions) {
  global.anypayTransactions = new Map();
}

// Random email domain for Snipe payer profiles (kept unique per request).
const EMAIL_DOMAINS = ['gmail.com', 'yahoo.com', 'outlook.com', 'icloud.com'];

// Snipe expects firstname / lastname / email separately.
function buildSnipeCustomer() {
  const first = pickRandom(FIRST_NAMES);
  const last = pickRandom(LAST_NAMES);
  const domain = pickRandom(EMAIL_DOMAINS);
  return {
    firstname: first,
    lastname: last,
    email: `${first.toLowerCase()}.${last.toLowerCase()}${Math.floor(Math.random() * 900 + 100)}@${domain}`,
  };
}

// Snipe wants the phone in international format (255...).
function formatPhoneForSnipe(phone) {
  const cleaned = String(phone || '').replace(/\D/g, '');
  if (cleaned.startsWith('255') && cleaned.length === 12) return cleaned;
  if (cleaned.startsWith('0')) return '255' + cleaned.substring(1);
  return '255' + cleaned;
}

// ============ HELPERS ============

const generateTransactionId = () =>
  `TXN${Date.now()}${crypto.randomBytes(4).toString('hex').toUpperCase()}`;

const generateReference = (prefix = 'REF') => {
  const randomDigits = Math.floor(10000000 + Math.random() * 90000000);
  return `${prefix}-${randomDigits}`;
};

const formatMoney = (n) =>
  new Intl.NumberFormat('en-TZ', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(n || 0);

function convertToLocalFormat(phone) {
  let cleaned = String(phone || '').replace(/\D/g, '');
  if (cleaned.startsWith('255')) {
    cleaned = '0' + cleaned.substring(3);
  }
  if (!cleaned.startsWith('0')) {
    cleaned = '0' + cleaned;
  }
  return cleaned;
}

// PalmPesa wants the phone in international format (255...), not local (0...).
function convertToInternationalFormat(phone) {
  let cleaned = String(phone || '').replace(/\D/g, '');
  if (cleaned.startsWith('255')) {
    return cleaned;
  }
  if (cleaned.startsWith('0')) {
    return '255' + cleaned.substring(1);
  }
  return '255' + cleaned;
}

// Credit the user's balance (dedicated method so PalmPesa + manual share logic).
// If `depositRequestId` is given, the matching PENDING deposit request is
// auto-confirmed instead of creating a brand new row.
async function creditBalance({ user_id, amount, bonusAmount = 0, reference, description, metaType, depositRequestId = null }) {
  let creditedUser;
  let depositRequest;
  await sequelize.transaction(async (t) => {
    const user = await User.findByPk(user_id, { transaction: t, lock: t.LOCK.UPDATE });
    if (!user) throw new CustomExceptions('User not found', 404);

    const balanceBefore = Number(user.balance);
    const total = parseFloat((Number(amount) + Number(bonusAmount)).toFixed(2));
    const newBalance = parseFloat((balanceBefore + total).toFixed(2));
    user.balance = newBalance;
    await user.save({ transaction: t });

    await Transaction.create(
      {
        reference,
        user_id,
        type: 'DEPOSIT',
        amount: total,
        balance_before: balanceBefore,
        balance_after: newBalance,
        status: 'SUCCESS',
        description,
      },
      { transaction: t }
    );

    if (depositRequestId) {
      // Auto-confirm the request created when the deposit was initiated.
      const existing = await DepositRequest.findByPk(depositRequestId, { transaction: t, lock: t.LOCK.UPDATE });
      if (existing) {
        existing.status = 'CONFIRMED';
        existing.confirmed_at = new Date();
        await existing.save({ transaction: t });
        depositRequest = existing;
      }
    }

    // Fallback: keep a history row in deposit_requests (auto-confirmed).
    if (!depositRequest) {
      depositRequest = await DepositRequest.create(
        {
          user_id,
          amount,
          status: 'CONFIRMED',
          confirmed_at: new Date(),
        },
        { transaction: t }
      );
    }

    creditedUser = user;
  });
  return { user: creditedUser, depositRequest };
}

// Send a notification to every admin user (in-app + FCM).
async function notifyAllAdmins({ title, message, type = 'alert', metadata = null }) {
  try {
    const admins = await User.findAll({ where: { role: 'ADMIN' }, attributes: ['phone_number'] });
    const phones = admins.map((u) => u.phone_number).filter(Boolean);
    if (phones.length === 0) return;
    await notificationService.sendToMultiple({
      phone_numbers: phones,
      title,
      message,
      type,
      metadata,
    });
  } catch (err) {
    console.error('Money admin notify failed:', err.message);
  }
}

// Send a notification to one user by phone.
async function notifyUser(phone_number, { title, message, type = 'info', metadata = null }) {
  try {
    await notificationService.sendToUser({ phone_number, title, message, type, metadata });
  } catch (err) {
    console.error('Money user notify failed:', err.message);
  }
}

async function fetchPalmPesaOrderStatus(orderId) {
  try {
    const response = await axios.post(
      `${PALMPESA.baseUrl}/api/order-status`,
      { order_id: orderId },
      {
        headers: {
          Authorization: `Bearer ${PALMPESA.apiToken}`,
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        timeout: 10000,
      }
    );
    return response.data;
  } catch (err) {
    console.error('❌ Error fetching direct status from PalmPesa:', err.message);
    return null;
  }
}

// Called when PalmPesa confirms a COMPLETED payment: credit balance + notify.
async function processSuccessfulPayment(transaction, transactionKey, paymentData) {
  if (transaction.status === 'completed') {
    return transaction;
  }

  const amount = parseFloat(paymentData.amount) || transaction.amount;
  const bonusAmount = amount >= 150000 ? 10000 : 0;

  const result = await creditBalance({
    user_id: transaction.user_id,
    amount,
    bonusAmount,
    reference: generateReference('DEP'),
    description:
      bonusAmount > 0
        ? `Deposit TZS ${amount} + bonus TZS ${bonusAmount}`
        : `Deposit TZS ${amount}`,
    depositRequestId: transaction.deposit_request_id || null,
  });

  transaction.status = 'completed';
  transaction.balance_added = true;
  transaction.new_balance = result.user.balance;
  transaction.completed_at = new Date().toISOString();
  if (paymentData.transid) transaction.transaction_reference = paymentData.transid;
  if (paymentData.channel) transaction.channel = paymentData.channel;
  global.palmPesaTransactions.set(transactionKey, transaction);

  console.log(`✅ Balance updated: +${amount} TZS for user ${transaction.user_id}`);
  console.log(`💰 New balance: ${result.user.balance}`);

  await notifyUser(transaction.user_phone, {
    title: 'Payment Received',
    message:
      bonusAmount > 0
        ? `Your deposit of TSh ${formatMoney(amount)} was received successfully plus bonus TZS ${formatMoney(bonusAmount)}. New balance: ${formatMoney(result.user.balance)}`
        : `Your deposit of TSh ${formatMoney(amount)} was received successfully. New balance: ${formatMoney(result.user.balance)}`,
    type: 'success',
    metadata: {
      type: 'deposit_received',
      deposit_request_id: result.depositRequest.id,
      amount,
      balance: result.user.balance,
    },
  });

  return transaction;
}

// ============ DEPOSIT (PALMPESA) ============

// POST /api/money/deposit/palmpesa
const depositViaPalmPesa = async ({ user_id, amount, phone_number }) => {
  const amountNum = Number(amount);
  if (!amountNum || amountNum < 500) {
    throw new CustomExceptions('Amount must be at least 500 TZS', 400);
  }
  if (!phone_number) {
    throw new CustomExceptions('Phone number is required', 400);
  }

  const user = await userRepository.findById(user_id);
  if (!user) throw new CustomExceptions('User not found', 404);

  const localPhone = convertToLocalFormat(phone_number);
  const transactionId = generateTransactionId();
  const payer = buildPayerProfile();

  const requestData = {
    name: payer.name,
    email: payer.email,
    phone: convertToInternationalFormat(localPhone),
    amount: amountNum,
    transaction_id: transactionId,
    address: payer.address,
    postcode: payer.postcode,
    callback_url: `${process.env.BASE_URL || 'https://sunbeting.com'}/api/money/palmpesa-webhook`,
  };

  console.log('📤 PalmPesa Deposit Request:', JSON.stringify(requestData, null, 2));

  let response;
  try {
    response = await axios.post(
      `${PALMPESA.baseUrl}/api/palmpesa/initiate`,
      requestData,
      {
        headers: {
          Authorization: `Bearer ${PALMPESA.apiToken}`,
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        timeout: 30000,
      }
    );
  } catch (error) {
    console.error('❌ PalmPesa deposit error:', error.message);
    let errorMessage = 'Failed to initiate payment';
    if (error.response?.data) {
      console.error('PalmPesa Error:', JSON.stringify(error.response.data, null, 2));
      errorMessage = error.response.data.message || error.response.data.error || errorMessage;
    }
    throw new CustomExceptions(errorMessage, 500);
  }

  const result = response.data;

  // Keep a PENDING deposit request for history (auto-confirmed on payment).
  let depositRequest = null;
  try {
    depositRequest = await DepositRequest.create({
      user_id,
      amount: amountNum,
      payer_phone: localPhone,
      status: 'PENDING',
      note: 'PalmPesa auto payment',
    });
  } catch (err) {
    console.error('Failed to create deposit request record:', err.message);
  }

  // Store in-memory transaction
  global.palmPesaTransactions.set(transactionId, {
    user_id,
    user_phone: user.phone_number,
    amount: amountNum,
    phone: localPhone,
    status: 'pending',
    order_id: result.order_id,
    deposit_request_id: depositRequest ? depositRequest.id : null,
    created_at: new Date().toISOString(),
  });

  // Notify user: request accepted
  await notifyUser(user.phone_number, {
    title: 'Deposit Request Sent',
    message: `Your request to fund TSh ${formatMoney(amountNum)} was received. Check your phone for the prompt to enter your PIN.`,
    type: 'info',
    metadata: {
      type: 'deposit_request',
      deposit_request_id: depositRequest ? depositRequest.id : null,
      transaction_id: transactionId,
      amount: amountNum,
      status: 'PENDING',
    },
  });

  // Notify admins (read-only — they see it but have NO accept/cancel for deposits)
  await notifyAllAdmins({
    title: 'New Deposit',
    message: `Deposit of TSh ${formatMoney(amountNum)} from ${user.phone_number} — auto-credited once paid.`,
    type: 'alert',
    metadata: {
      type: 'deposit_request',
      deposit_request_id: depositRequest ? depositRequest.id : null,
      amount: amountNum,
      payer_phone: user.phone_number,
      status: 'PENDING',
    },
  });

  return responseBuilder.success({
    status: 200,
    message: 'Payment initiated. Check your phone for the M-Pesa prompt.',
    data: {
      gateway: 'palmpesa',
      transaction_id: transactionId,
      order_id: result.order_id,
      amount: amountNum,
      phone: localPhone,
      status: 'pending',
    },
  });
};

// ============ DEPOSIT (SNIPE) ============

// Credit balance for a confirmed Snipe payment (reuses the DB-driven creditBalance
// so deposit_requests is auto-confirmed + history is kept).
async function processSuccessfulSnipe(transaction, transactionKey, paymentData) {
  if (transaction.status === 'completed') return transaction;

  const rawAmount = paymentData.amount;
  const amount = typeof rawAmount === 'object' && rawAmount && 'value' in rawAmount
    ? Number(rawAmount.value)
    : Number(rawAmount) || 0;
  const finalAmount = amount || transaction.amount;
  const bonusAmount = finalAmount >= 150000 ? 10000 : 0;

  const result = await creditBalance({
    user_id: transaction.user_id,
    amount: finalAmount,
    bonusAmount,
    reference: generateReference('DEP'),
    description:
      bonusAmount > 0
        ? `Deposit TZS ${finalAmount} + bonus TZS ${bonusAmount}`
        : `Deposit TZS ${finalAmount}`,
    depositRequestId: transaction.deposit_request_id || null,
  });

  transaction.status = 'completed';
  transaction.balance_added = true;
  transaction.new_balance = result.user.balance;
  transaction.completed_at = new Date().toISOString();
  global.snipeTransactions.set(transactionKey, transaction);

  console.log(`✅ Snipe balance updated: +${finalAmount} TZS for user ${transaction.user_id}`);

  await notifyUser(transaction.user_phone, {
    title: 'Payment Received',
    message:
      bonusAmount > 0
        ? `Your deposit of TSh ${formatMoney(finalAmount)} was received successfully plus bonus TZS ${formatMoney(bonusAmount)}. New balance: ${formatMoney(result.user.balance)}`
        : `Your deposit of TSh ${formatMoney(finalAmount)} was received successfully. New balance: ${formatMoney(result.user.balance)}`,
    type: 'success',
    metadata: {
      type: 'deposit_received',
      deposit_request_id: result.depositRequest.id,
      amount: finalAmount,
      balance: result.user.balance,
    },
  });

  return transaction;
}

const depositViaSnipe = async ({ user_id, amount, phone_number }) => {
  const amountNum = Number(amount);
  if (!amountNum || amountNum < 500) {
    throw new CustomExceptions('Amount must be at least 500 TZS', 400);
  }
  if (!phone_number) {
    throw new CustomExceptions('Phone number is required', 400);
  }

  const user = await userRepository.findById(user_id);
  if (!user) throw new CustomExceptions('User not found', 404);

  const transactionId = generateTransactionId();
  const snipePhone = formatPhoneForSnipe(phone_number);
  const customer = buildSnipeCustomer();

  const requestData = {
    payment_type: 'mobile',
    details: { amount: amountNum, currency: 'TZS' },
    phone_number: snipePhone,
    customer,
    webhook_url: `${process.env.BASE_URL || 'https://sunbeting.com'}/api/snippe-webhook`,
    metadata: {
      user_id,
      transaction_id: transactionId,
      internal_reference: transactionId,
    },
  };

  console.log('📤 Snipe Deposit Request:', JSON.stringify(requestData, null, 2));

  let result;
  try {
    const response = await axios.post(`${SNIPPE.baseUrl}/payments`, requestData, {
      headers: {
        Authorization: `Bearer ${SNIPPE.apiKey}`,
        'Content-Type': 'application/json',
        Accept: 'application/json',
        'Idempotency-Key': transactionId.substring(0, 30),
      },
      timeout: 30000,
    });
    result = response.data;
  } catch (error) {
    console.error('❌ Snipe deposit error:', error.message);
    let errorMessage = 'Failed to initiate payment';
    if (error.response?.data) {
      console.error('Snipe Error:', JSON.stringify(error.response.data, null, 2));
      errorMessage = error.response.data.message || error.response.data.error_code || errorMessage;
    }
    throw new CustomExceptions(errorMessage, 500);
  }

  console.log('✅ Snipe Response:', JSON.stringify(result, null, 2));

  if (result.status !== 'success' || !result.data) {
    throw new CustomExceptions(result.message || 'Failed to initiate payment', 500);
  }

  const paymentData = result.data;

  // Keep a PENDING deposit request for history (auto-confirmed on payment).
  let depositRequest = null;
  try {
    depositRequest = await DepositRequest.create({
      user_id,
      amount: amountNum,
      payer_phone: snipePhone,
      status: 'PENDING',
      note: 'Snipe auto payment',
    });
  } catch (err) {
    console.error('Failed to create deposit request record:', err.message);
  }

  global.snipeTransactions.set(transactionId, {
    user_id,
    user_phone: user.phone_number,
    amount: amountNum,
    phone: snipePhone,
    status: 'pending',
    snipe_reference: paymentData.reference,
    deposit_request_id: depositRequest ? depositRequest.id : null,
    created_at: new Date().toISOString(),
    expires_at: paymentData.expires_at,
  });

  await notifyUser(user.phone_number, {
    title: 'Deposit Request Sent',
    message: `Your request to fund TSh ${formatMoney(amountNum)} was received. Check your phone for the prompt to enter your PIN.`,
    type: 'info',
    metadata: {
      type: 'deposit_request',
      deposit_request_id: depositRequest ? depositRequest.id : null,
      transaction_id: transactionId,
      amount: amountNum,
      status: 'PENDING',
    },
  });

  await notifyAllAdmins({
    title: 'New Deposit',
    message: `Deposit of TSh ${formatMoney(amountNum)} from ${user.phone_number} — auto-credited once paid.`,
    type: 'alert',
    metadata: {
      type: 'deposit_request',
      deposit_request_id: depositRequest ? depositRequest.id : null,
      amount: amountNum,
      payer_phone: user.phone_number,
      status: 'PENDING',
    },
  });

  return responseBuilder.success({
    status: 200,
    message: 'Payment initiated. Check your phone for the mobile money prompt.',
    data: {
      gateway: 'snipe',
      transaction_id: transactionId,
      snipe_reference: paymentData.reference,
      amount: amountNum,
      phone: snipePhone,
      status: 'pending',
      expires_at: paymentData.expires_at,
    },
  });
};

// ============ DEPOSIT (ANYPAY) ============

// Credit balance for a confirmed AnyPay payment (reuses creditBalance so
// deposit_requests is auto-confirmed + history is kept).
async function processSuccessfulAnyPay(transaction, transactionKey, paymentData) {
  if (transaction.status === 'completed') return transaction;

  const amount = Number(paymentData.amount) || transaction.amount;
  const bonusAmount = amount >= 150000 ? 10000 : 0;

  const result = await creditBalance({
    user_id: transaction.user_id,
    amount,
    bonusAmount,
    reference: generateReference('DEP'),
    description:
      bonusAmount > 0
        ? `Deposit TZS ${amount} + bonus TZS ${bonusAmount}`
        : `Deposit TZS ${amount}`,
    depositRequestId: transaction.deposit_request_id || null,
  });

  transaction.status = 'completed';
  transaction.balance_added = true;
  transaction.new_balance = result.user.balance;
  transaction.completed_at = new Date().toISOString();
  if (paymentData.transactionId || paymentData.transid || paymentData.anypay_transid) {
    transaction.transaction_reference =
      paymentData.transactionId || paymentData.transid || paymentData.anypay_transid;
  }
  if (paymentData.channel || paymentData.paymentChannel || paymentData.anypay_channel) {
    transaction.channel = paymentData.channel || paymentData.paymentChannel || paymentData.anypay_channel;
  }
  global.anypayTransactions.set(transactionKey, transaction);

  console.log(`✅ AnyPay balance updated: +${amount} TZS for user ${transaction.user_id}`);
  console.log(`💰 New balance: ${result.user.balance}`);

  await notifyUser(transaction.user_phone, {
    title: 'Payment Received',
    message:
      bonusAmount > 0
        ? `Your deposit of TSh ${formatMoney(amount)} was received successfully plus bonus TZS ${formatMoney(bonusAmount)}. New balance: ${formatMoney(result.user.balance)}`
        : `Your deposit of TSh ${formatMoney(amount)} was received successfully. New balance: ${formatMoney(result.user.balance)}`,
    type: 'success',
    metadata: {
      type: 'deposit_received',
      deposit_request_id: result.depositRequest.id,
      amount,
      balance: result.user.balance,
    },
  });

  return transaction;
}

// POST /api/money/deposit/anypay - initiate an AnyPay wallet pull payment.
const depositViaAnyPay = async ({ user_id, amount, phone_number }) => {
  const amountNum = Number(amount);
  if (!amountNum || amountNum < 500) {
    throw new CustomExceptions('Amount must be at least 500 TZS', 400);
  }
  if (!phone_number) {
    throw new CustomExceptions('Phone number is required', 400);
  }

  if (!ANYPAY.apiKey) {
    throw new CustomExceptions(
      'AnyPay API key haijawekwa. Msimamizi aweke API key kwanza kwenye admin panel.',
      500
    );
  }

  const user = await userRepository.findById(user_id);
  if (!user) throw new CustomExceptions('User not found', 404);

  const transactionId = generateTransactionId();
  const orderId = `ORD-${Date.now()}${Math.floor(1000 + Math.random() * 9000)}`;
  const anypayPhone = convertToInternationalFormat(phone_number);

  const requestData = {
    order_id: orderId,
    phone: anypayPhone,
    amount: amountNum,
    webhook_url: `${process.env.BASE_URL || 'https://sunbeting.com'}/api/money/anypay-webhook`,
    webhook_version: 2,
  };

  console.log('📤 AnyPay Deposit Request:', JSON.stringify(requestData, null, 2));

  let result;
  try {
    const response = await axios.post(
      `${ANYPAY.baseUrl}/api/payments/wallet/pull/`,
      requestData,
      {
        headers: {
          'API-Key': ANYPAY.apiKey,
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        timeout: 30000,
      }
    );
    result = response.data;
  } catch (error) {
    console.error('❌ AnyPay deposit error:', error.message);
    let errorMessage = 'Failed to initiate payment';
    if (error.response?.data) {
      console.error('AnyPay Error:', JSON.stringify(error.response.data, null, 2));
      errorMessage = error.response.data.message || error.response.data.error || errorMessage;
    }
    throw new CustomExceptions(errorMessage, 500);
  }

  console.log('✅ AnyPay Response:', JSON.stringify(result, null, 2));

  if (result.status !== 'success') {
    throw new CustomExceptions(result.message || 'Failed to initiate payment', 500);
  }

  // AnyPay inatengeneza order_id yake mara nyingi - tumia ile inayorudi kwa
  // check-order-status, lakini kumbuka pia ile tuliituma kwa matching ya webhook.
  const trackedOrderId = result.order_id || orderId;

  // Keep a PENDING deposit request for history (auto-confirmed on payment).
  let depositRequest = null;
  try {
    depositRequest = await DepositRequest.create({
      user_id,
      amount: amountNum,
      payer_phone: phone_number,
      status: 'PENDING',
      note: `AnyPay auto payment | order=${trackedOrderId}`,
    });
  } catch (err) {
    console.error('Failed to create deposit request record:', err.message);
  }

  global.anypayTransactions.set(transactionId, {
    user_id,
    user_phone: user.phone_number,
    amount: amountNum,
    phone: phone_number,
    status: 'pending',
    order_id: trackedOrderId,
    request_order_id: orderId,
    anypay_reference: result.payment_reference || null,
    deposit_request_id: depositRequest ? depositRequest.id : null,
    created_at: new Date().toISOString(),
  });

  await notifyUser(user.phone_number, {
    title: 'Deposit Request Sent',
    message: `Your request to fund TSh ${formatMoney(amountNum)} was received. Check your phone for the prompt to enter your PIN.`,
    type: 'info',
    metadata: {
      type: 'deposit_request',
      deposit_request_id: depositRequest ? depositRequest.id : null,
      transaction_id: transactionId,
      amount: amountNum,
      status: 'PENDING',
    },
  });

  await notifyAllAdmins({
    title: 'New Deposit',
    message: `Deposit of TSh ${formatMoney(amountNum)} from ${user.phone_number} — auto-credited once paid via AnyPay.`,
    type: 'alert',
    metadata: {
      type: 'deposit_request',
      deposit_request_id: depositRequest ? depositRequest.id : null,
      amount: amountNum,
      payer_phone: user.phone_number,
      status: 'PENDING',
    },
  });

  return responseBuilder.success({
    status: 200,
    message:
      result.message === 'Request in progress...'
        ? 'Payment initiated. Check your phone for the mobile money prompt.'
        : result.message || 'Payment initiated. Check your phone for the mobile money prompt.',
    data: {
      gateway: 'anypay',
      transaction_id: transactionId,
      order_id: trackedOrderId,
      payment_reference: result.payment_reference || null,
      amount: amountNum,
      phone: phone_number,
      status: 'pending',
    },
  });
};

// POST /api/money/anypay-webhook  (PUBLIC, no auth)
const anyPayWebhook = async (body) => {
  console.log('🔥 AnyPay Webhook received:', JSON.stringify(body, null, 2));

  // Payload ya webhook inaweza kuwa chini ya "payload", "data", au moja kwa moja.
  const inner = body.payload || body.data || body;

  const orderRefs = [
    inner.orderReference,
    inner.order_id,
    body.orderReference,
    body.order_id,
    inner.reference,
    inner.transid,
  ].filter(Boolean);

  const paymentStatus = String(inner.status || body.status || inner.code || '').toUpperCase();
  const isCompleted =
    paymentStatus === 'COMPLETED' ||
    paymentStatus === 'SUCCESS' ||
    paymentStatus === '00';

  if (orderRefs.length === 0) {
    console.error('Missing order reference in AnyPay webhook');
    return { status: 400, body: { message: 'Missing order reference' } };
  }

  let foundTransaction = null;
  let foundKey = null;
  for (const [key, value] of global.anypayTransactions.entries()) {
    if (value.status === 'completed') continue;
    for (const ref of orderRefs) {
      if (
        value.order_id === ref ||
        value.request_order_id === ref ||
        (value.anypay_reference && value.anypay_reference === ref) ||
        (value.transaction_reference && value.transaction_reference === ref)
      ) {
        foundTransaction = value;
        foundKey = key;
        break;
      }
    }
    if (foundTransaction) break;
  }

  if (!foundTransaction) {
    console.log(`AnyPay transaction not found for refs: ${orderRefs.join(', ')}`);
    return { status: 200, body: { message: 'Transaction not found - stored for later' } };
  }

  if (foundTransaction.status === 'completed') {
    return { status: 200, body: { message: 'Already processed' } };
  }

  if (isCompleted) {
    try {
      await processSuccessfulAnyPay(foundTransaction, foundKey, {
        amount: inner.amount,
        transactionId: inner.transactionId || inner.transid,
        channel: inner.paymentChannel || inner.channel,
      });
    } catch (error) {
      console.error('❌ Error processing AnyPay webhook balance update:', error);
    }
  } else if (paymentStatus === 'FAILED') {
    foundTransaction.status = 'failed';
    foundTransaction.updated_at = new Date().toISOString();
    global.anypayTransactions.set(foundKey, foundTransaction);
  }

  return { status: 200, body: { message: 'Webhook received', status: 'success' } };
};

// Poll AnyPay check-order-status kwa transaction moja. Inajaribu order_id ya
// AnyPay kwanza, halafu ile iliyotumwa kwenye initiate. Inarudisha neno moja:
// 'completed' | 'failed' | 'pending'.
async function pollAnyPayOrderStatus(transaction) {
  const candidates = [transaction.order_id, transaction.request_order_id].filter(Boolean);
  for (const id of candidates) {
    try {
      const response = await axios.get(
        `${ANYPAY.baseUrl}/api/payments/check-order-status/`,
        {
          params: { order_id: id },
          headers: {
            'API-Key': ANYPAY.apiKey,
            Accept: 'application/json',
          },
          timeout: 10000,
        }
      );
      const raw = response.data || {};
      const data = raw.data || raw;
      const currentStatus = String(data.anypay_payment_status || '').toUpperCase();

      if (currentStatus === 'COMPLETED') {
        transaction.lastPolledAmount = data.anypay_amount;
        transaction.lastPolledTransId = data.anypay_transid;
        transaction.lastPolledChannel = data.anypay_channel;
        return 'completed';
      }
      if (currentStatus === 'FAILED') return 'failed';
      // Ikiwa API ilirudisha data (order imetambulika) usihangaike na id nyingine.
      if (data && Object.keys(data).length > 0) return 'pending';
    } catch (e) {
      console.error(`[ANYPAY] status poll error for ${id}:`, e.message);
    }
  }
  return 'pending';
}

// GET /api/money/payment/status/:transactionId  (for AnyPay-originated deposits)
const checkAnyPayStatus = async ({ user_id, transactionId }) => {
  const transaction = global.anypayTransactions.get(transactionId);
  if (!transaction) throw new CustomExceptions('Transaction not found', 404);
  if (transaction.user_id !== user_id) throw new CustomExceptions('Unauthorized', 403);

  if (transaction.status === 'pending') {
    const status = await pollAnyPayOrderStatus(transaction);
    if (status === 'completed' && transaction.status !== 'completed') {
      await processSuccessfulAnyPay(transaction, transactionId, {
        amount: transaction.lastPolledAmount,
        transactionId: transaction.lastPolledTransId,
        channel: transaction.lastPolledChannel,
      });
    } else if (status === 'failed') {
      transaction.status = 'failed';
      transaction.updated_at = new Date().toISOString();
      global.anypayTransactions.set(transactionId, transaction);
    }
  }

  return responseBuilder.success({
    status: 200,
    message: 'Payment status',
    data: {
      transaction_id: transactionId,
      amount: transaction.amount,
      phone: transaction.phone,
      status: transaction.status,
      gateway: 'anypay',
      order_id: transaction.order_id,
      created_at: transaction.created_at,
      updated_at: transaction.updated_at,
      new_balance: transaction.new_balance || null,
    },
  });
};

// POST /api/money/snipe-webhook  (PUBLIC, no auth)
const snipeWebhook = async (body) => {
  console.log('🔥 Snipe Webhook received:', JSON.stringify(body, null, 2));

  const eventType = body.type || body.event;
  const eventData = body.data || body;
  const reference = eventData.reference;

  if (eventType === 'payment.completed' || eventData.status === 'completed' || eventData.status === 'success') {
    if (!reference) return { status: 400, body: { message: 'Missing reference' } };

    let foundKey = null;
    let foundTransaction = null;
    for (const [key, value] of global.snipeTransactions.entries()) {
      if (value.snipe_reference === reference) {
        foundKey = key;
        foundTransaction = value;
        break;
      }
    }

    if (!foundTransaction) return { status: 200, body: { message: 'Transaction not found - stored for later' } };
    if (foundTransaction.status === 'completed') return { status: 200, body: { message: 'Already processed' } };

    try {
      await processSuccessfulSnipe(foundTransaction, foundKey, eventData);
    } catch (error) {
      console.error('❌ Error processing Snipe webhook balance update:', error);
    }
  } else if (eventType === 'payment.failed' || eventData.status === 'failed') {
    if (reference) {
      for (const [key, value] of global.snipeTransactions.entries()) {
        if (value.snipe_reference === reference) {
          value.status = 'failed';
          global.snipeTransactions.set(key, value);
          break;
        }
      }
    }
  }

  return { status: 200, body: { message: 'Webhook received', status: 'success' } };
};

// GET /api/money/payment/status/:transactionId  (for Snipe-originated deposits)
const checkSnipeStatus = async ({ user_id, transactionId }) => {
  const transaction = global.snipeTransactions.get(transactionId);
  if (!transaction) throw new CustomExceptions('Transaction not found', 404);
  if (transaction.user_id !== user_id) throw new CustomExceptions('Unauthorized', 403);

  if (transaction.status === 'pending' && transaction.snipe_reference) {
    try {
      const response = await axios.get(
        `${SNIPPE.baseUrl}/payments/${transaction.snipe_reference}`,
        {
          headers: {
            Authorization: `Bearer ${SNIPPE.apiKey}`,
            Accept: 'application/json',
          },
          timeout: 10000,
        }
      );
      const paymentData = response.data.data || response.data;
      const currentStatus = paymentData.status;

      if ((currentStatus === 'completed' || currentStatus === 'success') && transaction.status !== 'completed') {
        await processSuccessfulSnipe(transaction, transactionId, paymentData);
      } else if (currentStatus === 'failed' || currentStatus === 'expired') {
        transaction.status = currentStatus;
        global.snipeTransactions.set(transactionId, transaction);
      }
    } catch (apiError) {
      console.error('Error polling Snipe status:', apiError.message);
    }
  }

  return responseBuilder.success({
    status: 200,
    message: 'Payment status',
    data: {
      transaction_id: transactionId,
      amount: transaction.amount,
      phone: transaction.phone,
      status: transaction.status,
      gateway: 'snipe',
      created_at: transaction.created_at,
      updated_at: transaction.updated_at,
      new_balance: transaction.new_balance || null,
    },
  });
};

// ============ ANYPAY RECONCILIATION (SERVER-SIDE SAFETY NET) ============

// Re-hydrate in-memory AnyPay transactions kutoka DepositRequest PENDING zilizopo
// kwenye DB. Hii inakabili hali ambapo server ime-restart kati ya initiate na
// malipo kukamilika - deposits zilizoachwa hazipotei, reconciliation inamaliza.
async function hydratePendingAnyPayTransactions() {
  try {
    const pending = await DepositRequest.findAll({
      where: { status: 'PENDING' },
      order: [['createdAt', 'DESC']],
    });
    let restored = 0;
    for (const req of pending) {
      const note = req.note || '';
      if (!note.includes('AnyPay')) continue;

      const orderMatch = note.match(/order=([^\s|]+)/);
      const orderId = orderMatch ? orderMatch[1].trim() : null;
      const txnId = `ANYPAY-RECOVER-${req.id}`;
      if (global.anypayTransactions.has(txnId)) continue;

      let userPhone = null;
      try {
        const u = await userRepository.findById(req.user_id);
        userPhone = u ? u.phone_number : null;
      } catch (e) {
        // endelea na null
      }

      global.anypayTransactions.set(txnId, {
        user_id: req.user_id,
        user_phone: userPhone,
        amount: Number(req.amount) || 0,
        phone: req.payer_phone || null,
        status: 'pending',
        order_id: orderId,
        request_order_id: orderId,
        deposit_request_id: req.id,
        created_at: req.createdAt || new Date().toISOString(),
        recovered: true,
      });
      restored++;
    }
    if (restored) console.log(`[ANYPAY] rehydrated ${restored} pending deposit(s) from DB`);
  } catch (e) {
    console.warn('[ANYPAY] hydrate failed:', e.message);
  }
}

// Reconciliation sweep: loop kila pending AnyPay transaction, poll check-order-status
// kutoka kwenye AnyPay wenyewe, na kama COMPLETED ina-credit balance ya mtumiaji.
// Hii ndiyo njia ya uhakika ya kuongeza pesa hata kama webhook haikufika / haikufanana.
async function reconcileAnyPayPendingTransactions() {
  const pending = [...global.anypayTransactions.entries()].filter(
    ([, v]) => v.status === 'pending' && v.order_id
  );
  if (pending.length === 0) return;

  for (const [key, transaction] of pending) {
    try {
      const status = await pollAnyPayOrderStatus(transaction);
      if (status === 'completed' && transaction.status !== 'completed') {
        console.log(`[ANYPAY] RECONCILE: crediting ${transaction.amount} TZS for user ${transaction.user_id}`);
        await processSuccessfulAnyPay(transaction, key, {
          amount: transaction.lastPolledAmount,
          transactionId: transaction.lastPolledTransId,
          channel: transaction.lastPolledChannel,
        });
      } else if (status === 'failed') {
        transaction.status = 'failed';
        transaction.updated_at = new Date().toISOString();
        global.anypayTransactions.set(key, transaction);
      }
    } catch (e) {
      console.error(`[ANYPAY] reconcile error for ${key}:`, e.message);
    }
  }
}

// Start the safety-net cron: inarehydrate pending rows kisha ina-poll kila dakika.
function startAnyPayReconciliation() {
  hydratePendingAnyPayTransactions();

  cron.schedule('* * * * *', async () => {
    try {
      await hydratePendingAnyPayTransactions();
      await reconcileAnyPayPendingTransactions();
    } catch (e) {
      console.error('[ANYPAY] reconciliation cron error:', e.message);
    }
  });

  // Sweep mara moja mapema (server inapoanza) ili deposits zilizosubiri zikamilike upesi.
  setTimeout(() => {
    hydratePendingAnyPayTransactions().then(() => reconcileAnyPayPendingTransactions());
  }, 5000);

  console.log('[ANYPAY] Reconciliation cron started (every minute)');
}

// ============ UNIFIED DEPOSIT DISPATCHER ============

// POST /api/money/deposit - routes to the ACTIVE gateway (PalmPesa, Snipe or AnyPay).
const initiateDeposit = async ({ user_id, amount, phone_number }) => {
  const gateway = getActiveGateway();
  if (gateway === 'anypay') {
    return depositViaAnyPay({ user_id, amount, phone_number });
  }
  if (gateway === 'snipe') {
    return depositViaSnipe({ user_id, amount, phone_number });
  }
  return depositViaPalmPesa({ user_id, amount, phone_number });
};

// GET /api/money/payment/status/:transactionId - works for ALL gateways.
const checkDepositStatus = async ({ user_id, transactionId }) => {
  if (global.palmPesaTransactions.has(transactionId)) {
    return checkPalmPesaStatus({ user_id, transactionId });
  }
  if (global.snipeTransactions.has(transactionId)) {
    return checkSnipeStatus({ user_id, transactionId });
  }
  if (global.anypayTransactions.has(transactionId)) {
    return checkAnyPayStatus({ user_id, transactionId });
  }
  throw new CustomExceptions('Transaction not found', 404);
};

// ============ GATEWAY SWITCH (ADMIN) ============

// GET /api/money/deposit/gateway
const getDepositGateway = () =>
  responseBuilder.success({
    status: 200,
    message: 'Payment gateway',
    data: {
      active: getActiveGateway(),
      providers: Object.keys(PROVIDERS).map((key) => ({
        key,
        name: PROVIDERS[key].name,
      })),
    },
  });

// POST /api/money/deposit/gateway { gateway: 'palmpesa' | 'snipe' | 'anypay' }
const setDepositGateway = (gateway) => {
  const result = setActiveGateway(gateway);
  if (!result.ok) throw new CustomExceptions(result.error || 'Invalid gateway', 400);
  return responseBuilder.success({
    status: 200,
    message: `Payment gateway switched to ${result.active.toUpperCase()}`,
    data: { active: result.active },
  });
};

// ============ PROVIDER API KEYS (ADMIN) ============

// GET /api/money/deposit/gateway/keys (ADMIN) - retrieve provider API keys
const getProviderKeys = () =>
  responseBuilder.success({
    status: 200,
    message: 'Provider credentials retrieved',
    data: {
      active: getActiveGateway(),
      providers: getProviderCredentials(),
    },
  });

// PUT/POST /api/money/deposit/gateway/keys (ADMIN) - update provider API keys
// Body: { gateway: 'palmpesa'|'snipe', apiToken?/userId?/baseUrl?/apiKey? }
const updateProviderKeys = async (body = {}) => {
  const { gateway, ...updates } = body;
  const result = await updateProviderCredentials(gateway, updates);
  if (!result.ok) throw new CustomExceptions(result.error || 'Failed to update credentials', 400);
  return responseBuilder.success({
    status: 200,
    message: `API keys za ${gateway} zimesasishwa na kuhifadhiwa kwenye database`,
    data: {
      active: getActiveGateway(),
      providers: getProviderCredentials(),
    },
  });
};

// POST /api/money/palmpesa-webhook  (PUBLIC, no auth)
const palmPesaWebhook = async (body) => {
  console.log('🔥 PalmPesa Webhook received:', JSON.stringify(body, null, 2));

  const webhookData = body;
  const orderId = webhookData.reference || webhookData.order_id;
  const paymentData = webhookData.data?.[0] || webhookData;

  if (!orderId) {
    console.error('Missing order_id in webhook');
    return { status: 400, body: { error: 'Missing order_id' } };
  }

  let foundTransaction = null;
  let foundKey = null;
  for (const [key, value] of global.palmPesaTransactions.entries()) {
    if (value.order_id === orderId) {
      foundTransaction = value;
      foundKey = key;
      break;
    }
  }

  if (!foundTransaction) {
    console.log(`Transaction not found for order_id: ${orderId}`);
    return { status: 200, body: { message: 'Transaction not found - stored for later' } };
  }

  if (foundTransaction.status === 'completed') {
    console.log(`Transaction ${foundKey} already processed`);
    return { status: 200, body: { message: 'Already processed' } };
  }

  const paymentStatus = (paymentData.payment_status || webhookData.payment_status || 'PENDING').toUpperCase();

  if (paymentStatus === 'COMPLETED') {
    try {
      await processSuccessfulPayment(foundTransaction, foundKey, paymentData);
    } catch (error) {
      console.error('❌ Error processing webhook balance update:', error);
    }
  } else {
    foundTransaction.status = paymentStatus.toLowerCase();
    foundTransaction.updated_at = new Date().toISOString();
    global.palmPesaTransactions.set(foundKey, foundTransaction);
    console.log(`ℹ️ Payment ${foundKey} status updated to: ${paymentStatus}`);
  }

  return { status: 200, body: { message: 'Webhook received', status: 'success' } };
};

// GET /api/money/payment/status/:transactionId
const checkPalmPesaStatus = async ({ user_id, transactionId }) => {
  const transaction = global.palmPesaTransactions.get(transactionId);
  if (!transaction) throw new CustomExceptions('Transaction not found', 404);
  if (transaction.user_id !== user_id) throw new CustomExceptions('Unauthorized', 403);

  if (transaction.status === 'pending') {
    const orderStatusRes = await fetchPalmPesaOrderStatus(transaction.order_id);
    if (orderStatusRes && orderStatusRes.data && orderStatusRes.data.length > 0) {
      const liveData = orderStatusRes.data[0];
      const liveStatus = (liveData.payment_status || 'PENDING').toUpperCase();
      if (liveStatus === 'COMPLETED') {
        await processSuccessfulPayment(transaction, transactionId, liveData);
      } else if (liveStatus === 'FAILED') {
        transaction.status = 'failed';
        transaction.updated_at = new Date().toISOString();
        global.palmPesaTransactions.set(transactionId, transaction);
      }
    }
  }

  return responseBuilder.success({
    status: 200,
    message: 'Payment status',
    data: {
      transaction_id: transactionId,
      amount: transaction.amount,
      phone: transaction.phone,
      status: transaction.status,
      order_id: transaction.order_id,
      created_at: transaction.created_at,
      updated_at: transaction.updated_at,
      channel: transaction.channel || null,
      new_balance: transaction.new_balance || null,
    },
  });
};

// ============ WITHDRAW (DATABASE-DIRECT, IMMEDIATE BALANCE DEBIT) ============

// POST /api/money/withdraw - deduct the balance immediately. No notification
// is sent; the money leaves the user's account right away.
const withdraw = async ({ user_id, amount, phone_number = null }) => {
  const amountNum = Number(amount);
  if (!amountNum || amountNum < 1000) {
    throw new CustomExceptions('Minimum withdrawal is 1000 TZS', 400);
  }

  const user = await userRepository.findById(user_id);
  if (!user) throw new CustomExceptions('User not found', 404);

  let result;
  await sequelize.transaction(async (t) => {
    const lockedUser = await User.findByPk(user.id, { transaction: t, lock: t.LOCK.UPDATE });
    if (!lockedUser) throw new CustomExceptions('User not found', 404);

    const balanceBefore = Number(lockedUser.balance);
    if (balanceBefore < amountNum) {
      throw new CustomExceptions('Insufficient balance', 400);
    }

    const newBalance = parseFloat((balanceBefore - amountNum).toFixed(2));
    lockedUser.balance = newBalance;
    await lockedUser.save({ transaction: t });

    await Transaction.create(
      {
        reference: generateReference('WIT'),
        user_id: lockedUser.id,
        type: 'WITHDRAWAL',
        amount: amountNum,
        balance_before: balanceBefore,
        balance_after: newBalance,
        status: 'SUCCESS',
        description: 'Withdrawal',
      },
      { transaction: t }
    );

    const request = await WithdrawRequest.create(
      {
        user_id: lockedUser.id,
        amount: amountNum,
        phone_number: phone_number || lockedUser.phone_number || null,
        status: 'CONFIRMED',
        confirmed_at: new Date(),
      },
      { transaction: t }
    );

    result = { user: lockedUser, request };
  });

  return responseBuilder.success({
    status: 200,
    message: 'Withdrawal successful, balance updated',
    data: {
      withdraw_request: {
        id: result.request.id,
        amount: result.request.amount,
        phone_number: result.request.phone_number,
        status: result.request.status,
        confirmed_at: result.request.confirmed_at,
      },
      balance: result.user.balance,
    },
  });
};

// GET /api/money/withdraw/my - user's own withdraw requests
const getMyWithdrawRequests = async (user_id) => {
  const requests = await WithdrawRequest.findAll({
    where: { user_id },
    order: [['createdAt', 'DESC']],
  });
  return responseBuilder.success({
    message: 'Withdrawal requests fetched',
    data: { withdraw_requests: requests },
  });
};

// GET /api/money/withdraw/requests - admin sees all withdraw requests
const getAllWithdrawRequests = async ({ status = null, limit = 50, offset = 0 } = {}) => {
  const where = {};
  if (status) where.status = status;

  const limitNum = parseInt(limit, 10);
  const offsetNum = parseInt(offset, 10);

  const { rows, count } = await WithdrawRequest.findAndCountAll({
    where,
    order: [['createdAt', 'DESC']],
    limit: isNaN(limitNum) ? 50 : limitNum,
    offset: isNaN(offsetNum) ? 0 : offsetNum,
    include: [{ model: User, as: 'user', attributes: ['id', 'phone_number', 'role', 'balance'] }],
  });

  return responseBuilder.success({
    message: 'Withdrawal requests fetched',
    data: { withdraw_requests: rows, total: count },
  });
};

// POST /api/money/withdraw/confirm - ADMIN accepts; deduct balance from DB
const confirmWithdraw = async ({ request_id, admin_id, note = null }) => {
  if (!request_id) throw new CustomExceptions('Withdrawal request ID is required', 400);

  let result;
  await sequelize.transaction(async (t) => {
    const request = await WithdrawRequest.findOne({
      where: { id: request_id, status: 'PENDING' },
      transaction: t,
      lock: t.LOCK.UPDATE,
    });
    if (!request) {
      throw new CustomExceptions('Withdrawal request not found or already processed', 400);
    }

    const user = await User.findByPk(request.user_id, { transaction: t, lock: t.LOCK.UPDATE });
    if (!user) throw new CustomExceptions('User not found', 404);

    const balanceBefore = Number(user.balance);
    const amount = Number(request.amount);
    if (balanceBefore < amount) {
      throw new CustomExceptions('Insufficient balance', 400);
    }

    const newBalance = parseFloat((balanceBefore - amount).toFixed(2));
    user.balance = newBalance;
    await user.save({ transaction: t });

    await Transaction.create(
      {
        reference: generateReference('WIT'),
        user_id: user.id,
        type: 'WITHDRAWAL',
        amount,
        balance_before: balanceBefore,
        balance_after: newBalance,
        status: 'SUCCESS',
        description: `Withdrawal approved (request ${request.id})`,
      },
      { transaction: t }
    );

    request.status = 'CONFIRMED';
    request.admin_id = admin_id || null;
    request.confirmed_at = new Date();
    if (note) request.note = note;
    await request.save({ transaction: t });

    result = { request, user, amount };
  });

  await notifyUser(result.user.phone_number, {
    title: 'Withdrawal Approved',
    message: `Your withdrawal of TSh ${formatMoney(result.amount)} has been approved. New balance: ${formatMoney(result.user.balance)}`,
    type: 'success',
    metadata: {
      type: 'withdraw_approved',
      withdraw_request_id: result.request.id,
      amount: result.amount,
      balance: result.user.balance,
    },
  });

  return responseBuilder.success({
    message: 'Withdrawal approved and balance updated',
    data: {
      withdraw_request: {
        id: result.request.id,
        amount: result.request.amount,
        status: result.request.status,
        admin_id: result.request.admin_id,
        confirmed_at: result.request.confirmed_at,
      },
      balance: result.user.balance,
    },
  });
};

// POST /api/money/withdraw/cancel - ADMIN cancels
const cancelWithdraw = async ({ request_id, admin_id, note = null }) => {
  if (!request_id) throw new CustomExceptions('Withdrawal request ID is required', 400);

  const request = await WithdrawRequest.findOne({ where: { id: request_id, status: 'PENDING' } });
  if (!request) {
    throw new CustomExceptions('Withdrawal request not found or already processed', 400);
  }

  request.status = 'CANCELLED';
  request.admin_id = admin_id || null;
  request.cancelled_at = new Date();
  if (note) request.note = note;
  await request.save();

  const user = await userRepository.findById(request.user_id);
  if (user) {
    await notifyUser(user.phone_number, {
      title: 'Withdrawal Rejected',
      message: `Your withdrawal request of TSh ${formatMoney(request.amount)} was rejected. Please contact support.`,
      type: 'warning',
      metadata: {
        type: 'withdraw_rejected',
        withdraw_request_id: request.id,
        amount: request.amount,
      },
    });
  }

  return responseBuilder.success({
    message: 'Withdrawal request cancelled',
    data: { withdraw_request: { id: request.id, status: request.status } },
  });
};

// GET /api/money/balance
const getBalance = async (user_id) => {
  const user = await userRepository.findById(user_id);
  if (!user) throw new CustomExceptions('User not found', 404);
  return responseBuilder.success({
    status: 200,
    message: 'Balance retrieved',
    data: { balance: user.balance },
  });
};

module.exports = {
  // Unified deposit dispatcher (routes kwenye active gateway)
  initiateDeposit,
  checkDepositStatus,
  getDepositGateway,
  setDepositGateway,
  // Provider API keys (DB-backed, admin)
  getProviderKeys,
  updateProviderKeys,
  // PalmPesa
  depositViaPalmPesa,
  palmPesaWebhook,
  checkPalmPesaStatus,
  // Snipe
  depositViaSnipe,
  snipeWebhook,
  checkSnipeStatus,
  // AnyPay
  depositViaAnyPay,
  anyPayWebhook,
  checkAnyPayStatus,
  // AnyPay safety-net reconciliation (server-side)
  startAnyPayReconciliation,
  reconcileAnyPayPendingTransactions,
  hydratePendingAnyPayTransactions,
  // Withdraw
  withdraw,
  getMyWithdrawRequests,
  getAllWithdrawRequests,
  confirmWithdraw,
  cancelWithdraw,
  getBalance,
};
