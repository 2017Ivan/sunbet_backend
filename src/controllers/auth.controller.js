const userService = require('../services/auth.service');
const userRepository = require('../repositories/user.repository');
const axios = require('axios');
const crypto = require('crypto');

// ============ MONGIKE CONFIGURATION ============
const MONGIKE = {
  apiKey: 'mk_86b0b00fc59c39e6bd67e4307ec5560a827bece0c8fbf092',
  baseUrl: 'https://mongike.com/api/v1',
  paymentUrl: 'https://mongike.com/api/v1/payments/mobile-money/tanzania',
};

// ============ SNIPPE CONFIGURATION ============
const SNIPPE_CONFIG = {
  apiKey: 'snp_249e0510a26caa291588dd422a8c098005deb3771f2841afb93e6013d530f8f7',
  baseUrl: 'https://api.snippe.sh'
};

// Store pending payments
if (!global.mongikePayments) {
  global.mongikePayments = new Map();
}

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

function generateReference() {
  return `REF-${Date.now()}-${Math.random().toString(36).substr(2, 8)}`;
}

function generateMongikeRef(prefix = 'MONG') {
  return `${prefix}-${Date.now()}-${crypto.randomBytes(4).toString('hex')}`;
}

// ============ DEPOSIT MONEY ============
const depositMoney = async (req, res) => {
  try {
    const userId = req.user.id;
    const { amount, phone_number, fee_payer = 'MERCHANT' } = req.body;

    if (!amount || amount < 500) {
      return res.status(400).json({ message: 'Amount must be at least 500 TZS' });
    }

    if (!phone_number) {
      return res.status(400).json({ message: 'Phone number is required' });
    }

    const user = await userRepository.findById(userId);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    const formattedPhone = formatPhoneNumber(phone_number);
    const mongikePhone = formattedPhone.startsWith('255') ? formattedPhone : `255${formattedPhone}`;
    const order_id = generateMongikeRef('MONG');
    const summ = Number(amount).toFixed(0);

    // === IMPORTANT: Get your public URL ===
    // Ikiwa uko local, tumia ngrok. Ikiwa production, tumia domain yako
    const WEBHOOK_URL = 'http://109.123.246.231:5000/api/auth/mongike-webhook';
      const requestBody = {
        order_id: order_id,
        amount: parseFloat(summ),
        buyer_phone: mongikePhone,
        fee_payer: fee_payer,
        webhook_url: "http://109.123.246.231:5000/api/auth/mongike-webhook",
        buyer_name: user.full_name || user.name || "Customer",
        buyer_email: user.email || `${userId}@user.com`,
        metadata: {
          user_id: userId,
          source: "boombet_frontend",
          phone: user.phone_number
        }
      };

    console.log('=== MONGIKE DEPOSIT ===');
    console.log('Order ID:', order_id);
    console.log('Webhook URL:', WEBHOOK_URL);

    const response = await axios.post(
      MONGIKE.paymentUrl,
      requestBody,
      {
        headers: {
          'x-api-key': MONGIKE.apiKey,
          'Content-Type': 'application/json'
        },
        timeout: 30000
      }
    );

    const result = response.data;
    
    if (result.status !== 'success') {
      return res.status(400).json({
        message: result.message || 'Payment initiation failed'
      });
    }

    global.mongikePayments.set(order_id, {
      user_id: userId,
      amount: Number(amount),
      status: 'pending',
      timestamp: Date.now(),
      order_id: order_id,
      mongike_id: result.data.id,
      gateway_ref: result.data.gateway_ref,
      expires_at: result.data.expires_at,
      phone: mongikePhone
    });

    console.log('✅ Payment stored:', order_id);

    res.status(200).json({
      message: 'Payment initiated. Check your phone for PIN prompt.',
      data: {
        order_id: order_id,
        amount: amount,
        status: result.data.status,
        gateway_ref: result.data.gateway_ref,
        expires_at: result.data.expires_at
      }
    });

  } catch (error) {
    console.error('Deposit error:', error);
    res.status(500).json({ 
      message: error.response?.data?.message || 'Failed to initiate deposit'
    });
  }
};

// ============ MONGIKE WEBHOOK - ILIYOREKEBISHWA KWA DOCS ============
const mongikeWebhook = async (req, res) => {
  console.log('🔥🔥🔥 MONGIKE WEBHOOK HIT 🔥🔥🔥');
  console.log('Full body:', JSON.stringify(req.body, null, 2));
  console.log('Headers:', JSON.stringify(req.headers, null, 2));

  const webhookData = req.body;

  // === KWA MUJIBU WA DOCUMENTATION YAO ===
  // Webhook payload ina: order_id, payment_status, reference, amount
  const order_id = webhookData.order_id;
  const payment_status = webhookData.payment_status;  // ← 'payment_status' sio 'status'
  const reference = webhookData.reference;
  const amount = webhookData.amount;

  if (!order_id) {
    console.log('❌ No order_id in webhook');
    return res.status(400).json({ error: 'Missing order_id' });
  }

  // Verify API key from headers (security)
  const receivedApiKey = req.headers['x-api-key'];
  if (receivedApiKey !== MONGIKE.apiKey) {
    console.log('❌ Invalid API key in webhook');
    return res.status(401).json({ error: 'Invalid API key' });
  }

  const pendingPayment = global.mongikePayments.get(order_id);

  if (!pendingPayment) {
    console.log('❌ Pending payment not found:', order_id);
    return res.status(404).json({ error: 'Transaction not found' });
  }

  if (pendingPayment.status === 'completed') {
    console.log('✅ Payment already processed:', order_id);
    return res.status(200).json({ message: 'Already processed' });
  }

  // Check if payment is COMPLETED (kwa mujibu wa documentation)
  if (payment_status !== 'COMPLETED') {
    console.log('⚠️ Payment not completed. Status:', payment_status);
    pendingPayment.status = 'failed';
    global.mongikePayments.set(order_id, pendingPayment);
    return res.status(200).json({ message: 'Payment not completed' });
  }

  try {
    const amountToAdd = parseFloat(amount) || pendingPayment.amount;
    
    console.log(`💰 Processing payment for user ${pendingPayment.user_id}`);
    console.log(`💰 Amount: ${amountToAdd}`);
    
    const depositResult = await userService.deposit(pendingPayment.user_id, amountToAdd);
    
    pendingPayment.status = 'completed';
    pendingPayment.balance_added = true;
    pendingPayment.reference = reference;
    pendingPayment.completed_at = new Date().toISOString();
    global.mongikePayments.set(order_id, pendingPayment);

    console.log(`✅ Balance updated successfully!`);
    console.log(`   User: ${pendingPayment.user_id}`);
    console.log(`   Amount: +${amountToAdd} TZS`);
    console.log(`   New balance: ${depositResult.new_balance}`);
    console.log(`   Order ID: ${order_id}`);
    console.log(`   Reference: ${reference}`);

    return res.status(200).json({ 
      message: 'Payment processed successfully',
      order_id: order_id,
      status: 'success'
    });

  } catch (error) {
    console.error('❌ Error updating balance:', error);
    return res.status(500).json({ 
      error: 'Failed to process payment',
      order_id: order_id
    });
  }
};

// ============ CHECK PAYMENT STATUS ============
const checkPaymentStatus = async (req, res) => {
  try {
    const { reference } = req.params;
    const userId = req.user.id;

    console.log('🔍 Checking status for:', reference);

    const pendingPayment = global.mongikePayments.get(reference);

    if (!pendingPayment) {
      return res.status(200).json({
        success: false,
        status: 'not_found',
        message: 'Payment reference not found'
      });
    }

    if (pendingPayment.user_id !== userId) {
      return res.status(403).json({
        success: false,
        status: 'unauthorized',
        message: 'You do not own this payment'
      });
    }

    if (pendingPayment.expires_at && new Date(pendingPayment.expires_at) < new Date()) {
      pendingPayment.status = 'expired';
      global.mongikePayments.set(reference, pendingPayment);
      return res.status(200).json({
        success: false,
        status: 'expired',
        message: 'Payment has expired'
      });
    }

    if (pendingPayment.status === 'completed') {
      const user = await userRepository.findById(userId);
      return res.status(200).json({
        success: true,
        status: 'completed',
        data: {
          reference: reference,
          amount: pendingPayment.amount,
          new_balance: user?.balance || 0,
          gateway_ref: pendingPayment.gateway_ref
        }
      });
    }

    return res.status(200).json({
      success: false,
      status: 'pending',
      message: 'Payment pending. Complete payment on your phone.',
      expires_at: pendingPayment.expires_at
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

// ============ MANUAL CONFIRM DEPOSIT ============
const manualConfirmDeposit = async (req, res) => {
  try {
    const { order_id } = req.body;
    const userId = req.user.id;
    
    const pendingPayment = global.mongikePayments.get(order_id);
    
    if (!pendingPayment) {
      return res.status(404).json({ success: false, message: 'Payment not found' });
    }
    
    if (pendingPayment.user_id !== userId && !req.user.isAdmin) {
      return res.status(403).json({ success: false, message: 'Unauthorized' });
    }
    
    if (pendingPayment.status === 'completed') {
      return res.status(400).json({ success: false, message: 'Already processed' });
    }
    
    const depositResult = await userService.deposit(pendingPayment.user_id, pendingPayment.amount);
    
    pendingPayment.status = 'completed';
    pendingPayment.manual_confirmed = true;
    pendingPayment.confirmed_by = userId;
    global.mongikePayments.set(order_id, pendingPayment);
    
    res.status(200).json({
      success: true,
      message: 'Deposit confirmed manually',
      new_balance: depositResult.new_balance
    });
    
  } catch (error) {
    console.error('Manual confirm error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// ============ CHECK PENDING PAYMENTS ============
const checkPendingPayments = async (req, res) => {
  try {
    const userId = req.user.id;
    const pendingPayments = [];
    
    for (const [orderId, payment] of global.mongikePayments.entries()) {
      if (payment.user_id === userId && payment.status === 'pending') {
        pendingPayments.push({
          order_id: orderId,
          amount: payment.amount,
          timestamp: payment.timestamp,
          expires_at: payment.expires_at
        });
      }
    }
    
    res.status(200).json({ success: true, data: pendingPayments });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// ============ WITHDRAW MONEY ============
const withdrawMoney = async (req, res) => {
  try {
    const userId = req.user.id;
    const { amount } = req.body;

    if (!amount || amount < 1000) {
      return res.status(400).json({ message: 'Minimum withdrawal is 1000 TZS' });
    }

    const user = await userRepository.findById(userId);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    const currentBalance = parseFloat(user.balance) || 0;
    if (currentBalance < amount) {
      return res.status(400).json({ message: 'Insufficient balance' });
    }

    const newBalance = currentBalance - amount;
    await userRepository.updateBalance(userId, newBalance);

    res.status(200).json({
      message: `TZS ${amount.toLocaleString()} imetolewa. Salio: TZS ${newBalance.toLocaleString()}`,
      data: { amount, new_balance: newBalance }
    });

  } catch (error) {
    console.error('Withdraw error:', error);
    res.status(500).json({ message: 'Withdrawal failed' });
  }
};

// ============ ADMIN WITHDRAW ============
const AdminWithdrawMoneyDb = async (req, res) => {
  try {
    const userId = req.user.id;
    const { amount } = req.body;

    if (!amount || amount < 1000) {
      return res.status(400).json({ message: 'Minimum withdrawal is 1000 TZS' });
    }

    const user = await userRepository.findById(userId);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    const currentBalance = parseFloat(user.balance) || 0;
    if (currentBalance < amount) {
      return res.status(400).json({ message: 'Insufficient balance' });
    }

    const newBalance = currentBalance - amount;
    await userRepository.updateBalance(userId, newBalance);

    res.status(200).json({
      message: `TZS ${amount.toLocaleString()} imetolewa`,
      data: { amount, new_balance: newBalance }
    });

  } catch (error) {
    res.status(500).json({ message: 'Withdrawal failed' });
  }
};

// ============ CHECK BALANCE ============
const checkBalance = async (req, res) => {
  try {
    const userId = req.user.id;
    const result = await userService.getBalance(userId);
    res.status(200).json({ message: 'Balance retrieved', data: result });
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

// ============ GET PROFILE ============
const getProfile = async (req, res) => {
  try {
    const userId = req.user.id;
    const user = await userService.getProfile(userId);
    res.status(200).json({ message: 'Profile retrieved', data: user });
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

// ============ REGISTER ============
const register = async (req, res) => {
  try {
    const { phone_number, password } = req.body;
    if (!phone_number || !password) {
      return res.status(400).json({ message: 'Phone and password required' });
    }
    const user = await userService.registerUser(phone_number, password);
    res.status(201).json({ message: 'User registered successfully', data: user });
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

// ============ LOGIN ============
const login = async (req, res) => {
  try {
    const { phone_number, password } = req.body;
    if (!phone_number || !password) {
      return res.status(400).json({ message: 'Phone and password required' });
    }
    const user = await userService.loginUser(phone_number, password);
    res.status(200).json({ message: 'Login successful', data: user });
  } catch (error) {
    res.status(401).json({ message: error.message });
  }
};

// ============ REFRESH TOKEN ============
const refreshToken = async (req, res) => {
  try {
    const { refreshToken } = req.body;
    const newToken = await userService.refreshAccessToken(refreshToken);
    res.status(200).json({ message: 'Token refreshed', data: newToken });
  } catch (error) {
    res.status(401).json({ message: error.message });
  }
};

// ============ FORGOT PASSWORD ============
const forgotPassword = async (req, res) => {
  try {
    const { phone_number } = req.body;
    if (!phone_number) {
      return res.status(400).json({ message: 'Phone number required' });
    }
    const result = await userService.forgotPasswordRequest(phone_number);
    res.status(200).json({ success: true, userId: result.userId });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
};

const resetPassword = async (req, res) => {
  try {
    const { userId, newPassword, confirmPassword } = req.body;
    if (!userId || !newPassword || !confirmPassword) {
      return res.status(400).json({ message: 'All fields required' });
    }
    const result = await userService.resetPassword(userId, newPassword, confirmPassword);
    res.status(200).json({ success: true, message: result.message });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
};

const changePasswordByPhone = async (req, res) => {
  try {
    const { phone_number, newPassword, confirmPassword } = req.body;
    if (!phone_number || !newPassword || !confirmPassword) {
      return res.status(400).json({ message: 'All fields required' });
    }
    const result = await userService.changePasswordByPhone(phone_number, newPassword, confirmPassword);
    res.status(200).json({ success: true, message: result.message });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
};

// ============ CHECK ADMIN STATUS ============
const checkAdminStatus = async (req, res) => {
  try {
    const adminPhones = ['683307420', '748090224', '672572874', '745211365', '749003366', '690802328'];
    const isAdmin = adminPhones.includes(req.user.phone_number);
    res.json({ success: true, isAdmin: isAdmin });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// ============ ADMIN USER MANAGEMENT ============
const adminGetAllUsers = async (req, res) => {
  try {
    const { limit = 100, offset = 0 } = req.query;
    const result = await userService.adminGetAllUsers(parseInt(limit), parseInt(offset));
    res.status(200).json({ success: true, data: result });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
};

const adminGetUserByPhone = async (req, res) => {
  try {
    const { phone_number } = req.params;
    const result = await userService.adminGetUserByPhone(phone_number);
    res.status(200).json({ success: true, data: result });
  } catch (error) {
    res.status(404).json({ success: false, message: error.message });
  }
};

const adminSetBalanceByPhone = async (req, res) => {
  try {
    const { phone_number } = req.params;
    const { balance } = req.body;
    const result = await userService.adminSetBalanceByPhone(phone_number, balance);
    res.status(200).json({ success: true, data: result });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
};

const adminAddBalanceByPhone = async (req, res) => {
  try {
    const { phone_number } = req.params;
    const { amount } = req.body;
    const result = await userService.adminAddBalanceByPhone(phone_number, amount);
    res.status(200).json({ success: true, data: result });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
};

const adminDeductBalanceByPhone = async (req, res) => {
  try {
    const { phone_number } = req.params;
    const { amount } = req.body;
    const result = await userService.adminDeductBalanceByPhone(phone_number, amount);
    res.status(200).json({ success: true, data: result });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
};

const adminDeleteUserByPhone = async (req, res) => {
  try {
    const { phone_number } = req.params;
    const result = await userService.adminDeleteUserByPhone(phone_number);
    res.status(200).json({ success: true, data: result });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
};

// ============ EXPORT ============
module.exports = {
  register,
  login,
  refreshToken,
  forgotPassword,
  resetPassword,
  changePasswordByPhone,
  depositMoney,
  mongikeWebhook,
  checkPaymentStatus,
  manualConfirmDeposit,
  checkPendingPayments,
  withdrawMoney,
  AdminWithdrawMoneyDb,
  checkBalance,
  getProfile,
  checkAdminStatus,
  adminGetAllUsers,
  adminGetUserByPhone,
  adminSetBalanceByPhone,
  adminAddBalanceByPhone,
  adminDeductBalanceByPhone,
  adminDeleteUserByPhone
};