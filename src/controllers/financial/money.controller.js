// controllers/money.controller.js
const userService = require('../../services/auth.service');
const userRepository = require('../../repositories/user.repository');
const axios = require('axios');
const crypto = require('crypto');

// ============ PALMPESA CONFIGURATION ============
const PALMPESA = {
  apiToken: 'pcDa26lbTBRJ3vnOSdfqXvpXNdXH2YgUqvlrk4b9FuRYwDLpoqFDr4oO4Ia7', 
  userId: '1083',    
  baseUrl: 'https://palmpesa.drmlelwa.co.tz',
  endpoints: {
    payByLink: '/api/process-payment',
    initiatePayment: '/api/palmpesa/initiate',
    payViaMobile: '/api/pay-via-mobile'
  }
};

// Store pending transactions
if (!global.palmPesaTransactions) {
  global.palmPesaTransactions = new Map();
}

// ============ HELPERS ============
function formatPhoneNumber(phone) {
  let cleaned = phone.replace(/\D/g, '');
  if (cleaned.startsWith('0')) {
    cleaned = '255' + cleaned.substring(1);
  }
  if (!cleaned.startsWith('255')) {
    cleaned = '255' + cleaned;
  }
  return cleaned;
}

function generateOrderId(prefix = 'BB') {
  return `${prefix}-${Date.now()}-${crypto.randomBytes(4).toString('hex')}`;
}

function generateTransactionId() {
  return `TXN${Date.now()}${crypto.randomBytes(4).toString('hex').toUpperCase()}`;
}

// ============ DEPOSIT ============

/**
 * POST /api/deposit - Initiate deposit via PalmPesa
 */

const depositMoney = async (req, res) => {
  try {
    const userId = req.user.id;
    const { amount, phone_number } = req.body;

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

    const user = await userRepository.findById(userId);
    if (!user) {
      return res.status(404).json({ 
        success: false,
        message: 'User not found' 
      });
    }

    const formattedPhone = formatPhoneNumber(phone_number);
    const orderId = generateOrderId('BB');
    const transactionId = generateTransactionId();

    // Store transaction reference
    global.palmPesaTransactions.set(orderId, {
      user_id: userId,
      amount: Number(amount),
      status: 'pending',
      timestamp: Date.now(),
      order_id: orderId,
      phone: formattedPhone
    });

    // Prepare request payload
    const requestData = {
      user_id: PALMPESA.userId,
      vendor: "TILL61103867",
      order_id: orderId,
      buyer_email: user.email || `${userId}@user.com`,
      buyer_name: user.full_name || user.name || "Customer",
      buyer_phone: formattedPhone,
      amount: Number(amount),
      currency: "TZS",
      redirect_url: "https://sunbeting.com/deposit-success",
      cancel_url: "https://sunbeting.com/deposit-cancel",
      webhook: "https://sunbeting.com/api/palmpesa-webhook",
      buyer_remarks: `Deposit for user ${userId}`,
      merchant_remarks: "sunbet Deposit",
      no_of_items: 1
    };

    console.log('=== PALMPESA DEPOSIT ===');
    console.log('Order ID:', orderId);
    console.log('Amount:', amount);

    // Make request to PalmPesa
    const response = await axios.post(
      `${PALMPESA.baseUrl}${PALMPESA.endpoints.payByLink}`,
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

    // Update transaction with payment gateway URL
    const transaction = global.palmPesaTransactions.get(orderId);
    if (transaction) {
      transaction.payment_url = result.raw?.payment_gateway_url;
      global.palmPesaTransactions.set(orderId, transaction);
    }

    res.status(200).json({
      success: true,
      message: 'Payment initiated. Use the payment link to complete.',
      data: {
        order_id: orderId,
        amount: amount,
        payment_url: result.raw?.payment_gateway_url || null,
        expires_in: '30 minutes'
      }
    });

  } catch (error) {
    console.error('PalmPesa deposit error:', error);
    res.status(500).json({ 
      success: false,
      message: error.response?.data?.message || 'Failed to initiate deposit'
    });
  }
};

/**
 * POST /api/palmpesa-webhook - PalmPesa webhook handler
 */
const palmPesaWebhook = async (req, res) => {
  console.log('🔥 PALMPESA WEBHOOK HIT');
  console.log('Body:', JSON.stringify(req.body, null, 2));

  const webhookData = req.body;
  const orderId = webhookData.reference || webhookData.order_id;
  const paymentData = webhookData.data?.[0] || webhookData;

  if (!orderId) {
    console.error('Missing order_id in webhook');
    return res.status(400).json({ error: 'Missing order_id' });
  }

  const transaction = global.palmPesaTransactions.get(orderId);

  if (!transaction) {
    console.error(`Transaction not found: ${orderId}`);
    return res.status(404).json({ error: 'Transaction not found' });
  }

  // Prevent duplicate processing
  if (transaction.status === 'completed') {
    console.log(`Transaction ${orderId} already processed`);
    return res.status(200).json({ message: 'Already processed' });
  }

  const paymentStatus = paymentData.payment_status || webhookData.payment_status || 'PENDING';

  if (paymentStatus !== 'COMPLETED') {
    transaction.status = 'failed';
    global.palmPesaTransactions.set(orderId, transaction);
    console.log(`❌ Payment ${orderId} status: ${paymentStatus}`);
    return res.status(200).json({ message: 'Payment not completed' });
  }

  try {
    const amount = parseFloat(paymentData.amount) || transaction.amount;
    const depositResult = await userService.deposit(transaction.user_id, amount);
    
    transaction.status = 'completed';
    transaction.balance_added = true;
    transaction.reference = paymentData.reference || paymentData.transid || orderId;
    transaction.transaction_id = paymentData.transid;
    transaction.channel = paymentData.channel;
    transaction.completed_at = new Date().toISOString();
    global.palmPesaTransactions.set(orderId, transaction);

    console.log(`✅ Balance updated: +${amount} TZS for user ${transaction.user_id}`);

    return res.status(200).json({ 
      message: 'Payment processed successfully',
      order_id: orderId,
      status: 'success'
    });

  } catch (error) {
    console.error('Error updating balance:', error);
    return res.status(500).json({ 
      error: 'Failed to process payment',
      order_id: orderId
    });
  }
};

/**
 * POST /api/deposit/mobile - Direct mobile money deposit
 */
const depositViaMobile = async (req, res) => {
  try {
    const userId = req.user.id;
    const { amount, phone_number } = req.body;

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

    const user = await userRepository.findById(userId);
    if (!user) {
      return res.status(404).json({ 
        success: false,
        message: 'User not found' 
      });
    }

    const formattedPhone = formatPhoneNumber(phone_number);
    const transactionId = generateTransactionId();

    const requestData = {
      user_id: PALMPESA.userId,
      name: user.full_name || user.name || "Customer",
      email: user.email || `${userId}@user.com`,
      phone: formattedPhone,
      amount: Number(amount),
      transaction_id: transactionId,
      address: user.address || "Dar es Salaam",
      postcode: "11111",
      buyer_uuid: userId
    };

    console.log('=== PALMPESA MOBILE DEPOSIT ===');
    console.log('Transaction ID:', transactionId);

    const response = await axios.post(
      `${PALMPESA.baseUrl}${PALMPESA.endpoints.payViaMobile}`,
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

    // Store transaction
    global.palmPesaTransactions.set(transactionId, {
      user_id: userId,
      amount: Number(amount),
      status: 'pending',
      timestamp: Date.now(),
      order_id: result.order_id || transactionId,
      phone: formattedPhone,
      reference: result.response?.reference
    });

    res.status(200).json({
      success: true,
      message: 'Payment request sent to your phone. Please check and approve.',
      data: {
        transaction_id: transactionId,
        order_id: result.order_id,
        amount: amount,
        status: result.response?.result || 'PENDING'
      }
    });

  } catch (error) {
    console.error('Mobile deposit error:', error);
    res.status(500).json({ 
      success: false,
      message: error.response?.data?.message || 'Failed to initiate mobile payment'
    });
  }
};

/**
 * GET /api/payment/:reference - Check payment status
 */
const checkPaymentStatus = async (req, res) => {
  try {
    const { reference } = req.params;
    const userId = req.user.id;

    const transaction = global.palmPesaTransactions.get(reference);

    if (!transaction) {
      return res.status(200).json({
        success: false,
        status: 'not_found',
        message: 'Payment reference not found'
      });
    }

    if (transaction.user_id !== userId) {
      return res.status(403).json({
        success: false,
        status: 'unauthorized',
        message: 'You do not own this payment'
      });
    }

    if (transaction.status === 'completed') {
      const user = await userRepository.findById(userId);
      return res.status(200).json({
        success: true,
        status: 'completed',
        data: {
          reference: reference,
          amount: transaction.amount,
          new_balance: user?.balance || 0,
          channel: transaction.channel || 'N/A',
          completed_at: transaction.completed_at
        }
      });
    }

    return res.status(200).json({
      success: false,
      status: transaction.status || 'pending',
      message: 'Payment pending. Please complete the payment.',
      data: {
        reference: reference,
        amount: transaction.amount,
        payment_url: transaction.payment_url || null
      }
    });

  } catch (error) {
    console.error('Status check error:', error);
    res.status(500).json({
      success: false,
      status: 'error',
      message: 'Failed to check payment status'
    });
  }
};

/**
 * POST /api/payment/manual-confirm - Manual confirm deposit
 */
const manualConfirmDeposit = async (req, res) => {
  try {
    const { order_id } = req.body;
    const userId = req.user.id;
    
    const transaction = global.palmPesaTransactions.get(order_id);
    
    if (!transaction) {
      return res.status(404).json({ 
        success: false, 
        message: 'Transaction not found' 
      });
    }
    
    if (transaction.user_id !== userId && !req.user.isAdmin) {
      return res.status(403).json({ 
        success: false, 
        message: 'Unauthorized' 
      });
    }
    
    if (transaction.status === 'completed') {
      return res.status(400).json({ 
        success: false, 
        message: 'Already processed' 
      });
    }
    
    const depositResult = await userService.deposit(transaction.user_id, transaction.amount);
    
    transaction.status = 'completed';
    transaction.manual_confirmed = true;
    transaction.confirmed_by = userId;
    transaction.completed_at = new Date().toISOString();
    global.palmPesaTransactions.set(order_id, transaction);
    
    res.status(200).json({
      success: true,
      message: 'Deposit confirmed manually',
      data: {
        new_balance: depositResult.new_balance
      }
    });
    
  } catch (error) {
    console.error('Manual confirm error:', error);
    res.status(500).json({ 
      success: false, 
      message: error.message 
    });
  }
};

/**
 * GET /api/payments/pending - Check pending payments
 */
const checkPendingPayments = async (req, res) => {
  try {
    const userId = req.user.id;
    const pendingPayments = [];
    
    for (const [orderId, transaction] of global.palmPesaTransactions.entries()) {
      if (transaction.user_id === userId && transaction.status === 'pending') {
        pendingPayments.push({
          order_id: orderId,
          amount: transaction.amount,
          timestamp: transaction.timestamp,
          payment_url: transaction.payment_url || null
        });
      }
    }
    
    res.status(200).json({ 
      success: true, 
      data: pendingPayments 
    });
  } catch (error) {
    res.status(500).json({ 
      success: false, 
      message: error.message 
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

    if (!amount || amount < 1000) {
      return res.status(400).json({ 
        success: false,
        message: 'Minimum withdrawal is 1000 TZS' 
      });
    }

    const user = await userRepository.findById(userId);
    if (!user) {
      return res.status(404).json({ 
        success: false,
        message: 'User not found' 
      });
    }

    const currentBalance = parseFloat(user.balance) || 0;
    if (currentBalance < amount) {
      return res.status(400).json({ 
        success: false,
        message: 'Insufficient balance' 
      });
    }

    const newBalance = currentBalance - amount;
    await userRepository.updateBalance(userId, newBalance);

    res.status(200).json({
      success: true,
      message: `TZS ${amount.toLocaleString()} withdrawn successfully. Balance: TZS ${newBalance.toLocaleString()}`,
      data: { 
        amount, 
        new_balance: newBalance 
      }
    });

  } catch (error) {
    console.error('Withdraw error:', error);
    res.status(500).json({ 
      success: false,
      message: 'Withdrawal failed' 
    });
  }
};

/**
 * GET /api/balance - Check balance
 */
const checkBalance = async (req, res) => {
  try {
    const userId = req.user.id;
    const result = await userService.getBalance(userId);
    res.status(200).json({ 
      success: true,
      message: 'Balance retrieved', 
      data: result 
    });
  } catch (error) {
    res.status(400).json({ 
      success: false,
      message: error.message 
    });
  }
};

// ============ EXPORT ============
module.exports = {
  // Deposit
  depositMoney,
  palmPesaWebhook,
  depositViaMobile,
  checkPaymentStatus,
  manualConfirmDeposit,
  checkPendingPayments,
  
  // Withdraw
  withdrawMoney,
  checkBalance
};