// controllers/financial/money.controller.js
const userService = require('../../services/auth.service');
const userRepository = require('../../repositories/user.repository');
const axios = require('axios');
const crypto = require('crypto');

// ============ PALMPESA CONFIGURATION ============
const PALMPESA = {
  apiToken: 'frc7sTSxod2FFN8gvtIA3ilXA9EFIkvMVpg96tyrMAEHfKfV2pmpMOLjQksW',
  userId: '1083',
  baseUrl: 'https://palmpesa.drmlelwa.co.tz',
};

// Store pending transactions (in memory - use Redis/DB in production)
if (!global.palmPesaTransactions) {
  global.palmPesaTransactions = new Map();
}

// ============ HELPERS ============
function generateTransactionId() {
  return `TXN${Date.now()}${crypto.randomBytes(4).toString('hex').toUpperCase()}`;
}

function convertToLocalFormat(phone) {
  let cleaned = phone.replace(/\D/g, '');
  if (cleaned.startsWith('255')) {
    cleaned = '0' + cleaned.substring(3);
  }
  if (!cleaned.startsWith('0')) {
    cleaned = '0' + cleaned;
  }
  return cleaned;
}

// Helper function to query PalmPesa status directly
async function fetchPalmPesaOrderStatus(orderId) {
  try {
    const response = await axios.post(
      `${PALMPESA.baseUrl}/api/order-status`,
      { order_id: orderId },
      {
        headers: {
          'Authorization': `Bearer ${PALMPESA.apiToken}`,
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        timeout: 10000
      }
    );
    return response.data;
  } catch (err) {
    console.error('❌ Error fetching direct status from PalmPesa:', err.message);
    return null;
  }
}

// Helper function to complete transaction & update user balance
async function processSuccessfulPayment(transaction, transactionKey, paymentData) {
  if (transaction.status === 'completed') {
    return transaction; // Prevent double processing
  }

  const amount = parseFloat(paymentData.amount) || transaction.amount;
  
  // Call userService deposit to update balance
  const depositResult = await userService.deposit(transaction.user_id, amount);

  transaction.status = 'completed';
  transaction.balance_added = true;
  transaction.new_balance = depositResult.new_balance;
  transaction.completed_at = new Date().toISOString();

  if (paymentData.transid) {
    transaction.transaction_reference = paymentData.transid;
  }
  if (paymentData.channel) {
    transaction.channel = paymentData.channel;
  }

  global.palmPesaTransactions.set(transactionKey, transaction);

  console.log(`✅ Balance updated: +${amount} TZS for user ${transaction.user_id}`);
  console.log(`💰 New balance: ${depositResult.new_balance}`);

  return transaction;
}

// ============ PALMPESA DEPOSIT (Mobile Money) ============

/**
 * POST /api/deposit/palmpesa - Initiate PalmPesa mobile money deposit
 */
const depositViaPalmPesa = async (req, res) => {
  try {
    const userId = req.user.id;
    const { amount, phone_number } = req.body;

    // Validate amount
    if (!amount || amount < 500) {
      return res.status(400).json({
        success: false,
        message: 'Amount must be at least 500 TZS'
      });
    }

    if (!phone_number) {
      return res.status(400).json({
        success: false,
        message: 'Phone number is required'
      });
    }

    // Check if user exists
    const user = await userRepository.findById(userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    // Convert phone to local format (0xx)
    const localPhone = convertToLocalFormat(phone_number);
    const transactionId = generateTransactionId();

    // Build PalmPesa request
    const requestData = {
      name: "Customer Payment",
      email: "roger@gmail.com",
      phone: localPhone,
      amount: Number(amount),
      transaction_id: transactionId,
      address: "Dar es Salaam",
      postcode: "11111",
      callback_url: `${process.env.BASE_URL || 'https://sunbeting.com'}/api/palmpesa-webhook`
    };

    console.log('📤 PalmPesa Deposit Request:', JSON.stringify(requestData, null, 2));

    // Call PalmPesa API
    const response = await axios.post(
      `${PALMPESA.baseUrl}/api/palmpesa/initiate`,
      requestData,
      {
        headers: {
          'Authorization': `Bearer ${PALMPESA.apiToken}`,
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        timeout: 30000
      }
    );

    const result = response.data;
    console.log('✅ PalmPesa Response:', JSON.stringify(result, null, 2));

    // Store transaction
    global.palmPesaTransactions.set(transactionId, {
      user_id: userId,
      amount: Number(amount),
      phone: localPhone,
      status: 'pending',
      order_id: result.order_id,
      created_at: new Date().toISOString()
    });

    res.status(200).json({
      success: true,
      message: 'Payment initiated. Check your phone for the M-Pesa prompt.',
      data: {
        transaction_id: transactionId,
        order_id: result.order_id,
        amount: amount,
        phone: localPhone,
        status: 'pending'
      }
    });

  } catch (error) {
    console.error('❌ PalmPesa deposit error:', error);

    let errorMessage = 'Failed to initiate payment';
    if (error.response?.data) {
      console.error('PalmPesa Error:', JSON.stringify(error.response.data, null, 2));
      errorMessage = error.response.data.message || error.response.data.error || errorMessage;
    }

    res.status(500).json({
      success: false,
      message: errorMessage
    });
  }
};

// ============ PALMPESA WEBHOOK ============

/**
 * POST /api/palmpesa-webhook - PalmPesa webhook handler
 */
const palmPesaWebhook = async (req, res) => {
  console.log('🔥 PalmPesa Webhook received:', JSON.stringify(req.body, null, 2));

  const webhookData = req.body;
  const orderId = webhookData.reference || webhookData.order_id;
  const paymentData = webhookData.data?.[0] || webhookData;

  if (!orderId) {
    console.error('Missing order_id in webhook');
    return res.status(400).json({ error: 'Missing order_id' });
  }

  // Find transaction by order_id
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
    return res.status(200).json({ message: 'Transaction not found - stored for later' });
  }

  // Prevent duplicate processing
  if (foundTransaction.status === 'completed') {
    console.log(`Transaction ${foundKey} already processed`);
    return res.status(200).json({ message: 'Already processed' });
  }

  const paymentStatus = (paymentData.payment_status || webhookData.payment_status || 'PENDING').toUpperCase();

  // If payment is COMPLETED, update user balance
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

  res.status(200).json({
    message: 'Webhook received',
    status: 'success'
  });
};

// ============ CHECK PALMPESA PAYMENT STATUS ============

/**
 * GET /api/payment/status/:transactionId - Check PalmPesa payment status
 */
const checkPalmPesaStatus = async (req, res) => {
  try {
    const { transactionId } = req.params;
    const userId = req.user.id;

    const transaction = global.palmPesaTransactions.get(transactionId);

    if (!transaction) {
      return res.status(404).json({
        success: false,
        message: 'Transaction not found'
      });
    }

    // Check if user owns this transaction
    if (transaction.user_id !== userId) {
      return res.status(403).json({
        success: false,
        message: 'Unauthorized'
      });
    }

    // Fallback Check: Kama status bado ni 'pending', pigia PalmPesa API moja kwa moja
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

    res.status(200).json({
      success: true,
      data: {
        transaction_id: transactionId,
        amount: transaction.amount,
        phone: transaction.phone,
        status: transaction.status,
        order_id: transaction.order_id,
        created_at: transaction.created_at,
        updated_at: transaction.updated_at,
        channel: transaction.channel || null,
        new_balance: transaction.new_balance || null
      }
    });

  } catch (error) {
    console.error('Status check error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to check payment status'
    });
  }
};

// ============ REGULAR DEPOSIT (Manual/Admin) ============

/**
 * POST /api/deposit - Deposit money (manual deposit)
 */
const depositMoney = async (req, res) => {
  try {
    const userId = req.user.id;
    const { amount } = req.body;

    // Validate amount
    if (!amount || amount < 500) {
      return res.status(400).json({
        success: false,
        message: 'Amount must be at least 500 TZS'
      });
    }

    // Call userService deposit
    const result = await userService.deposit(userId, amount);

    res.status(200).json({
      success: true,
      message: `TZS ${amount.toLocaleString()} deposited successfully. Balance: TZS ${result.new_balance.toLocaleString()}`,
      data: {
        amount: result.deposited_amount,
        previous_balance: result.previous_balance,
        new_balance: result.new_balance
      }
    });

  } catch (error) {
    console.error('Deposit error:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Deposit failed'
    });
  }
};

// ============ WITHDRAW ============

/**
 * POST /api/withdraw - Withdraw money
 */
const withdrawMoney = async (req, res) => {
  try {
    const userId = req.user.id;
    const { amount } = req.body;

    // Validate amount
    if (!amount || amount < 1000) {
      return res.status(400).json({
        success: false,
        message: 'Minimum withdrawal is 1000 TZS'
      });
    }

    // Call userService withdraw
    const result = await userService.withdraw(userId, amount);

    res.status(200).json({
      success: true,
      message: `TZS ${amount.toLocaleString()} withdrawn successfully. Balance: TZS ${result.new_balance.toLocaleString()}`,
      data: {
        amount: result.withdrawn_amount,
        previous_balance: result.previous_balance,
        new_balance: result.new_balance
      }
    });

  } catch (error) {
    console.error('Withdraw error:', error);

    // Handle specific errors
    if (error.message === 'Insufficient balance') {
      return res.status(400).json({
        success: false,
        message: 'Insufficient balance'
      });
    }

    res.status(500).json({
      success: false,
      message: error.message || 'Withdrawal failed'
    });
  }
};

// ============ BALANCE ============

/**
 * GET /api/balance - Check balance
 */
const checkBalance = async (req, res) => {
  try {
    const userId = req.user.id;

    // Call userService getBalance
    const result = await userService.getBalance(userId);

    res.status(200).json({
      success: true,
      message: 'Balance retrieved successfully',
      data: {
        balance: result.balance
      }
    });

  } catch (error) {
    console.error('Balance error:', error);
    res.status(400).json({
      success: false,
      message: error.message || 'Failed to get balance'
    });
  }
};

// ============ EXPORT ============
module.exports = {
  // PalmPesa deposit
  depositViaPalmPesa,
  palmPesaWebhook,
  checkPalmPesaStatus,

  // Regular deposit
  depositMoney,

  // Withdraw & Balance
  withdrawMoney,
  checkBalance
};