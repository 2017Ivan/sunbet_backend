const userService = require('../services/auth.service');
const userRepository = require('../repositories/user.repository');
const axios = require('axios');
const crypto = require('crypto');

// ============ MONGIKE CONFIGURATION ============
const MONGIKE = {
  apiKey: 'mk_86b0b00fc59c39e6bd67e4307ec5560a827bece0c8fbf092', // CHANGE THIS - get from Mongike dashboard
  baseUrl: 'https://mongike.com/api/v1',
  paymentUrl: 'https://mongike.com/api/v1/payments/mobile-money/tanzania',
  webhookSecret: 'your_webhook_secret_here', // CHANGE THIS - if provided by Mongike
  success_url: 'https://betnoer.com/user/deposit/history',
  failed_url: 'https://betnovr.com/user/deposit/history'
};

// ============ SNIPPE CONFIGURATION (Unchanged) ============
const SNIPPE_CONFIG = {
  apiKey: 'snp_249e0510a26caa291588dd422a8c098005deb3771f2841afb93e6013d530f8f7',
  baseUrl: 'https://api.snippe.sh'
};

// Store pending payments for Mongike
if (!global.mongikePayments) {
  global.mongikePayments = new Map();
}

// Helper function to format phone number
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

// ============ DEPOSIT MONEY WITH MONGIKE ============
const depositMoney = async (req, res) => {
  try {
    const userId = req.user.id;
    const { amount, phone_number, fee_payer = 'MERCHANT' } = req.body;

    // Validation
    if (!amount || amount < 500) {
      return res.status(400).json({ 
        message: 'Amount must be at least 500 TZS' 
      });
    }

    if (!phone_number) {
      return res.status(400).json({ 
        message: 'Phone number is required for payment' 
      });
    }

    // Get user from database
    const user = await userRepository.findById(userId);

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Format phone number for Mongike (without +)
    const formattedPhone = formatPhoneNumber(phone_number);
    // Remove '255' prefix if present (Mongike expects 255... format)
    const mongikePhone = formattedPhone.startsWith('255') ? formattedPhone : `255${formattedPhone}`;
    
    const order_id = generateMongikeRef('MONG');
    const summ = Number(amount).toFixed(0); // Mongike expects whole number (no decimals)

    // Prepare request to Mongike
    const requestBody = {
      order_id: order_id,
      amount: parseFloat(summ),
      buyer_phone: mongikePhone,
      fee_payer: fee_payer, // 'MERCHANT' or 'CUSTOMER'
      buyer_name: user.full_name || user.name || 'Customer',
      buyer_email: user.email || `${userId}@user.com`,
      metadata: {
        user_id: userId,
        source: 'boombet_frontend',
        phone: user.phone_number
      }
    };

    console.log('=== MONGIKE DEPOSIT INITIATION ===');
    console.log('User ID:', userId);
    console.log('Amount:', amount);
    console.log('Order ID:', order_id);
    console.log('Phone:', mongikePhone);

    // Call Mongike API
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
      console.error('Mongike initiation failed:', result);
      return res.status(400).json({
        message: result.message || 'Payment initiation failed'
      });
    }

    // Store pending payment for webhook/confirmation
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

    console.log('✅ Mongike payment initiated:', {
      payment_id: result.data.id,
      status: result.data.status,
      expires_at: result.data.expires_at
    });

    res.status(200).json({
      message: 'Payment initiated successfully. Please check your phone and enter PIN to complete payment.',
      data: {
        payment_id: result.data.id,
        order_id: order_id,
        amount: amount,
        status: result.data.status,
        gateway_ref: result.data.gateway_ref,
        expires_at: result.data.expires_at,
        instruction: 'Open your mobile money app and enter PIN to complete payment'
      }
    });

  } catch (error) {
    console.error('Mongike deposit error:', {
      message: error.message,
      response: error.response?.data,
      status: error.response?.status
    });
    
    res.status(500).json({ 
      message: error.response?.data?.message || 'Failed to initiate deposit. Please try again.'
    });
  }
};

// ============ MONGIKE WEBHOOK (Called by Mongike when payment completes) ============
const mongikeWebhook = async (req, res) => {
  console.log('🔔 Mongike Webhook received:', req.body);

  const webhookData = req.body;

  // 1. Verify webhook signature if Mongike provides one
  // (Add signature verification here if Mongike provides webhook secret)
  
  // 2. Extract payment data
  const { order_id, status, gateway_ref, transaction_id, amount } = webhookData;

  if (!order_id) {
    console.log('❌ No order_id in webhook');
    return res.status(400).json({ error: 'Missing order_id' });
  }

  // 3. Get pending payment from global store
  const pendingPayment = global.mongikePayments.get(order_id);

  if (!pendingPayment) {
    console.log('❌ Pending payment not found:', order_id);
    return res.status(404).json({ error: 'Transaction not found' });
  }

  // 4. Check if already processed
  if (pendingPayment.status === 'completed') {
    console.log('✅ Payment already processed:', order_id);
    return res.status(200).json({ message: 'Already processed' });
  }

  // 5. Process only if payment is successful
  if (status !== 'success' && status !== 'COMPLETED') {
    console.log('⚠️ Payment not successful:', status);
    pendingPayment.status = 'failed';
    global.mongikePayments.set(order_id, pendingPayment);
    return res.status(200).json({ message: 'Payment not successful' });
  }

  // 6. UPDATE USER BALANCE USING YOUR EXISTING userService.deposit()
  try {
    const amountToAdd = parseFloat(amount) || pendingPayment.amount;
    
    // CALL YOUR EXISTING SERVICE METHOD
    const depositResult = await userService.deposit(pendingPayment.user_id, amountToAdd);
    
    // 7. UPDATE PENDING PAYMENT STATUS
    pendingPayment.status = 'completed';
    pendingPayment.balance_added = true;
    pendingPayment.transaction_id = transaction_id || gateway_ref;
    pendingPayment.completed_at = new Date().toISOString();
    global.mongikePayments.set(order_id, pendingPayment);

    console.log(`✅ Balance updated successfully via Mongike webhook`);
    console.log(`   User: ${pendingPayment.user_id}`);
    console.log(`   Amount: +${amountToAdd} TZS`);
    console.log(`   Old balance: ${depositResult.previous_balance}`);
    console.log(`   New balance: ${depositResult.new_balance}`);
    console.log(`   Order ID: ${order_id}`);
    console.log(`   Gateway Ref: ${gateway_ref}`);

    return res.status(200).json({ 
      message: 'Payment processed successfully',
      order_id: order_id,
      status: 'success'
    });

  } catch (error) {
    console.error('❌ Error updating balance via webhook:', error);
    return res.status(500).json({ 
      error: 'Failed to process payment',
      order_id: order_id
    });
  }
};

// ============ CHECK PAYMENT STATUS (SIMPLIFIED - NO EXTRA TABLE) ============
const checkPaymentStatus = async (req, res) => {
  try {
    const { reference } = req.params;
    const userId = req.user.id;

    console.log('Checking payment status for:', reference);

    // Get pending payment from memory
    const pendingPayment = global.mongikePayments.get(reference);

    if (!pendingPayment) {
      return res.status(200).json({
        success: false,
        status: 'not_found',
        message: 'Payment reference not found'
      });
    }

    // Check if user owns this payment
    if (pendingPayment.user_id !== userId) {
      return res.status(403).json({
        success: false,
        status: 'unauthorized',
        message: 'You do not own this payment'
      });
    }

    if (pendingPayment.status === 'completed') {
      // Get UPDATED balance directly from users table
      const user = await userRepository.findById(userId);
      return res.status(200).json({
        success: true,
        status: 'completed',
        data: {
          reference: reference,
          amount: pendingPayment.amount,
          new_balance: user?.balance || 0,  // ← Direct from users table
          gateway_ref: pendingPayment.gateway_ref
        }
      });
    }

    // Check if payment has expired
    if (pendingPayment.expires_at && new Date(pendingPayment.expires_at) < new Date()) {
      pendingPayment.status = 'expired';
      global.mongikePayments.set(reference, pendingPayment);
      return res.status(200).json({
        success: false,
        status: 'expired',
        message: 'Payment has expired. Please initiate a new deposit.'
      });
    }

    return res.status(200).json({
      success: false,
      status: 'pending',
      message: 'Payment still pending. Please complete payment on your phone.',
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

// ============ CONFIRM DEPOSIT (Called from frontend success page) ============
const confirmDeposit = async (req, res) => {
  try {
    const { order_id } = req.body;
    const userId = req.user?.id; // May come from auth or not
    
    if (!order_id) {
      return res.status(400).json({
        success: false,
        message: 'Order ID is required'
      });
    }

    // Get pending payment from global store
    const pendingPayment = global.mongikePayments.get(order_id);

    if (!pendingPayment) {
      return res.status(404).json({
        success: false,
        message: 'Transaction not found'
      });
    }

    // Check if already processed
    if (pendingPayment.status === 'completed') {
      const user = await userRepository.findById(pendingPayment.user_id);
      return res.status(200).json({
        success: true,
        message: 'Deposit already processed',
        amount: pendingPayment.amount,
        new_balance: user?.balance || 0
      });
    }

    // Check if payment is still pending (not confirmed by webhook yet)
    // In this case, we'll try to query Mongike for status
    // For now, return pending status
    return res.status(200).json({
      success: false,
      status: 'pending',
      message: 'Payment is being processed. You will receive confirmation shortly.',
      order_id: order_id,
      amount: pendingPayment.amount
    });

  } catch (error) {
    console.error('Confirm deposit error:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to process deposit'
    });
  }
};

// ============ MANUAL DEPOSIT CONFIRMATION (Admin Fallback) ============
const manualConfirmDeposit = async (req, res) => {
  try {
    const { order_id, amount } = req.body;
    const userId = req.user.id;
    
    const pendingPayment = global.mongikePayments.get(order_id);
    
    if (!pendingPayment) {
      return res.status(404).json({ 
        success: false, 
        message: 'Payment record not found' 
      });
    }
    
    if (pendingPayment.user_id !== userId && !req.user.isAdmin) {
      return res.status(403).json({ 
        success: false, 
        message: 'Unauthorized' 
      });
    }
    
    if (pendingPayment.status === 'completed') {
      return res.status(400).json({ 
        success: false, 
        message: 'Payment already processed' 
      });
    }
    
    // Process deposit manually
    const depositResult = await userService.deposit(
      pendingPayment.user_id, 
      amount || pendingPayment.amount
    );
    
    // Update status
    pendingPayment.status = 'completed';
    pendingPayment.manual_confirmed = true;
    pendingPayment.confirmed_by = userId;
    pendingPayment.confirmed_at = new Date().toISOString();
    global.mongikePayments.set(order_id, pendingPayment);
    
    res.status(200).json({
      success: true,
      message: 'Deposit confirmed manually',
      data: depositResult
    });
    
  } catch (error) {
    console.error('Manual confirm error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// ============ CHECK PENDING PAYMENTS (For user dashboard) ============
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
          status: payment.status,
          expires_at: payment.expires_at,
          gateway_ref: payment.gateway_ref
        });
      }
    }
    
    res.status(200).json({
      success: true,
      data: pendingPayments
    });
  } catch (error) {
    console.error('Check pending payments error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// ============ WITHDRAW MONEY WITH SNIPPE (Unchanged) ============
const withdrawMoney = async (req, res) => {
  try {
    const userId = req.user.id;
    const { amount } = req.body;

    if (!amount || amount < 1000) {
      return res.status(400).json({ 
        message: 'Minimum withdrawal amount is 1000 TZS' 
      });
    }

    const user = await userRepository.findById(userId);

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    const currentBalance = parseFloat(user.balance) || 0;
    if (currentBalance < amount) {
      return res.status(400).json({ 
        message: `Insufficient balance. Your balance is TZS ${currentBalance.toLocaleString()}` 
      });
    }

    const formattedPhone = formatPhoneNumber(user.phone_number);
    const reference = generateReference();

    console.log('=== SNIPPE WITHDRAW ===');
    console.log('User ID:', userId);
    console.log('Phone:', formattedPhone);
    console.log('Amount:', amount);

    const requestBody = {
      amount: Number(amount),
      channel: "mobile",
      recipient_phone: formattedPhone,
      recipient_name: user.full_name || "Snippe User",
      narration: `Withdrawal from wallet`,
      webhook_url: "https://your-server.com/webhook",
      metadata: {
        user_id: userId,
        type: "withdrawal"
      }
    };

    const response = await axios.post(
      `${SNIPPE_CONFIG.baseUrl}/v1/payouts/send`,
      requestBody,
      {
        headers: {
          'Authorization': `Bearer ${SNIPPE_CONFIG.apiKey}`,
          'Content-Type': 'application/json',
          'Idempotency-Key': reference
        },
        timeout: 30000
      }
    );

    const result = response.data;

    if (result.status !== 'success') {
      return res.status(400).json({
        message: result.message || 'Withdrawal initiation failed'
      });
    }

    const newBalance = currentBalance - amount;
    await userRepository.updateBalance(userId, newBalance);

    res.status(200).json({
      message: `TZS ${amount.toLocaleString()} zimetumwa kwa ${formattedPhone}. Angalia simu yako.`,
      data: {
        reference: result.data?.reference,
        amount: amount,
        new_balance: newBalance,
        status: 'completed'
      }
    });

  } catch (error) {
    console.error('Snippe withdraw error:', {
      message: error.message,
      response: error.response?.data,
      status: error.response?.status
    });
    
    res.status(500).json({ 
      message: error.response?.data?.message || 'Failed to process withdrawal. Please try again.'
    });
  }
};

// ============ ADMIN WITHDRAW (Unchanged) ============
const AdminWithdrawMoney = async (req, res) => {
  try {
    const userId = req.user.id;
    const { amount } = req.body;

    if (!amount || amount < 1000) {
      return res.status(400).json({ 
        message: 'Minimum withdrawal amount is 1000 TZS' 
      });
    }

    const user = await userRepository.findById(userId);

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    const currentBalance = parseFloat(user.balance) || 0;
    if (currentBalance < amount) {
      return res.status(400).json({ 
        message: `Insufficient balance. Your balance is TZS ${currentBalance.toLocaleString()}` 
      });
    }

    const formattedPhone = formatPhoneNumber(user.phone_number);
    const reference = generateReference();

    console.log('=== SNIPPE WITHDRAW ===');
    console.log('User ID:', userId);
    console.log('Phone:', formattedPhone);
    console.log('Amount:', amount);

    const requestBody = {
      amount: Number(amount),
      channel: "mobile",
      recipient_phone: formattedPhone,
      recipient_name: user.full_name || "Snippe User",
      narration: `Withdrawal from wallet`,
      webhook_url: "https://your-server.com/webhook",
      metadata: {
        user_id: userId,
        type: "withdrawal"
      }
    };

    const response = await axios.post(
      `${SNIPPE_CONFIG.baseUrl}/v1/payouts/send`,
      requestBody,
      {
        headers: {
          'Authorization': `Bearer ${SNIPPE_CONFIG.apiKey}`,
          'Content-Type': 'application/json',
          'Idempotency-Key': reference
        },
        timeout: 30000
      }
    );

    const result = response.data;

    if (result.status !== 'success') {
      return res.status(400).json({
        message: result.message || 'Withdrawal initiation failed'
      });
    }

    const newBalance = currentBalance - amount;
    await userRepository.updateBalance(userId, newBalance);

    res.status(200).json({
      message: `TZS ${amount.toLocaleString()} zimetumwa kwa ${formattedPhone}. Angalia simu yako.`,
      data: {
        reference: result.data?.reference,
        amount: amount,
        new_balance: newBalance,
        status: 'completed'
      }
    });

  } catch (error) {
    console.error('Snippe withdraw error:', {
      message: error.message,
      response: error.response?.data,
      status: error.response?.status
    });
    
    res.status(500).json({ 
      message: error.response?.data?.message || 'Failed to process withdrawal. Please try again.'
    });
  }
};

const AdminWithdrawMoneyDb = async (req, res) => {
  try {
    const userId = req.user.id;
    const { amount } = req.body;

    if (!amount || amount < 1000) {
      return res.status(400).json({ 
        message: 'Minimum withdrawal amount is 1000 TZS' 
      });
    }

    const user = await userRepository.findById(userId);

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    const currentBalance = parseFloat(user.balance) || 0;
    if (currentBalance < amount) {
      return res.status(400).json({ 
        message: `Insufficient balance. Your balance is TZS ${currentBalance.toLocaleString()}` 
      });
    }

    const newBalance = currentBalance - amount;
    await userRepository.updateBalance(userId, newBalance);

    console.log('=== WITHDRAWAL PROCESSED ===');
    console.log('User ID:', userId);
    console.log('Phone:', user.phone_number);
    console.log('Amount:', amount);
    console.log('Old Balance:', currentBalance);
    console.log('New Balance:', newBalance);

    res.status(200).json({
      message: `TZS ${amount.toLocaleString()} imetolewa kwenye akaunti yako. Salio lako sasa ni TZS ${newBalance.toLocaleString()}`,
      data: {
        amount: amount,
        old_balance: currentBalance,
        new_balance: newBalance,
        status: 'completed',
        processed_at: new Date()
      }
    });

  } catch (error) {
    console.error('Withdrawal error:', error);
    
    res.status(500).json({ 
      message: 'Failed to process withdrawal. Please try again.'
    });
  }
};

// ============ CHECK BALANCE (Unchanged) ============
const checkBalance = async (req, res) => {
  try {
    const userId = req.user.id;
    const result = await userService.getBalance(userId);

    res.status(200).json({
      message: 'Balance retrieved successfully',
      data: result
    });

  } catch (error) {
    res.status(400).json({ 
      message: error.message 
    });
  }
};

// ============ GET PROFILE (Unchanged) ============
const getProfile = async (req, res) => {
  try {
    const userId = req.user.id;
    const user = await userService.getProfile(userId);
    
    res.status(200).json({
      message: 'Profile retrieved successfully',
      data: user
    });
  } catch (error) {
    res.status(400).json({ 
      message: error.message 
    });
  }
};

// ============ REGISTER (Unchanged) ============
const register = async (req, res) => {
  try {
    const { phone_number, password } = req.body;

    if (!phone_number || !password) {
      return res.status(400).json({ message: 'Phone and password required' });
    }

    const user = await userService.registerUser(phone_number, password);

    res.status(201).json({
      message: 'User registered successfully',
      data: user
    });

  } catch (error) {
    res.status(400).json({
      message: error.message
    });
  }
};

// ============ LOGIN (Unchanged) ============
const login = async (req, res) => {
  try {
    const { phone_number, password } = req.body;

    if (!phone_number || !password) {
      return res.status(400).json({ message: 'Phone and password required' });
    }

    const user = await userService.loginUser(phone_number, password);

    res.status(200).json({
      message: 'Login successful',
      data: user
    });

  } catch (error) {
    res.status(401).json({
      message: error.message
    });
  }
};

// ============ REFRESH TOKEN (Unchanged) ============
const refreshToken = async (req, res) => {
  try {
    const { refreshToken } = req.body;

    const newToken = await userService.refreshAccessToken(refreshToken);

    res.status(200).json({
      message: 'Token refreshed',
      data: newToken
    });

  } catch (error) {
    res.status(401).json({ message: error.message });
  }
};

// ============ CHECK ADMIN STATUS (Unchanged) ============
const checkAdminStatus = async (req, res) => {
  try {
    const user = req.user;
    const adminPhones = ['683307420', '748090224','672572874','745211365','749003366','690802328'];
    const userPhone = user.phone_number || user.phone;
    
    const isAdmin = adminPhones.includes(userPhone);
    
    res.json({
      success: true,
      isAdmin: isAdmin,
      phone: userPhone
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// ============ FORGOT PASSWORD FUNCTIONS (Unchanged) ============
const forgotPassword = async (req, res) => {
  try {
    const { phone_number } = req.body;

    if (!phone_number) {
      return res.status(400).json({ 
        message: 'Phone number is required' 
      });
    }

    const result = await userService.forgotPasswordRequest(phone_number);

    res.status(200).json({
      success: true,
      message: 'If phone number exists in our system, you can proceed to reset your password',
      userId: result.userId 
    });

  } catch (error) {
    res.status(400).json({
      success: false,
      message: error.message
    });
  }
};

const resetPassword = async (req, res) => {
  try {
    const { userId, newPassword, confirmPassword } = req.body;

    if (!userId || !newPassword || !confirmPassword) {
      return res.status(400).json({ 
        message: 'User ID, new password and confirm password are required' 
      });
    }

    const result = await userService.resetPassword(userId, newPassword, confirmPassword);

    res.status(200).json({
      success: true,
      message: result.message,
      data: {
        phone_number: result.phone_number
      }
    });

  } catch (error) {
    res.status(400).json({
      success: false,
      message: error.message
    });
  }
};

const changePasswordByPhone = async (req, res) => {
  try {
    const { phone_number, newPassword, confirmPassword } = req.body;

    if (!phone_number || !newPassword || !confirmPassword) {
      return res.status(400).json({ 
        message: 'Phone number, new password and confirm password are required' 
      });
    }

    const result = await userService.changePasswordByPhone(phone_number, newPassword, confirmPassword);

    res.status(200).json({
      success: true,
      message: result.message,
      data: {
        phone_number: result.phone_number
      }
    });

  } catch (error) {
    res.status(400).json({
      success: false,
      message: error.message
    });
  }
};

// ============ ADMIN: GET ALL USERS (Unchanged) ============
const adminGetAllUsers = async (req, res) => {
  try {
    const { limit = 100, offset = 0 } = req.query;
    
    const result = await userService.adminGetAllUsers(parseInt(limit), parseInt(offset));
    
    res.status(200).json({
      success: true,
      message: 'Users retrieved successfully',
      data: result
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: error.message
    });
  }
};

const adminGetUserByPhone = async (req, res) => {
  try {
    const { phone_number } = req.params;
    
    if (!phone_number) {
      return res.status(400).json({
        success: false,
        message: 'Phone number is required'
      });
    }
    
    const result = await userService.adminGetUserByPhone(phone_number);
    
    res.status(200).json({
      success: true,
      message: 'User retrieved successfully',
      data: result
    });
  } catch (error) {
    res.status(404).json({
      success: false,
      message: error.message
    });
  }
};

const adminSetBalanceByPhone = async (req, res) => {
  try {
    const { phone_number } = req.params;
    const { balance } = req.body;
    
    if (!phone_number) {
      return res.status(400).json({
        success: false,
        message: 'Phone number is required'
      });
    }
    
    if (balance === undefined || balance < 0) {
      return res.status(400).json({
        success: false,
        message: 'Valid balance amount is required'
      });
    }
    
    const result = await userService.adminSetBalanceByPhone(phone_number, balance);
    
    res.status(200).json({
      success: true,
      message: result.message,
      data: result
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: error.message
    });
  }
};

const adminAddBalanceByPhone = async (req, res) => {
  try {
    const { phone_number } = req.params;
    const { amount } = req.body;
    
    if (!phone_number) {
      return res.status(400).json({
        success: false,
        message: 'Phone number is required'
      });
    }
    
    if (!amount || amount <= 0) {
      return res.status(400).json({
        success: false,
        message: 'Valid amount greater than 0 is required'
      });
    }
    
    const result = await userService.adminAddBalanceByPhone(phone_number, amount);
    
    res.status(200).json({
      success: true,
      message: result.message,
      data: result
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: error.message
    });
  }
};

const adminDeductBalanceByPhone = async (req, res) => {
  try {
    const { phone_number } = req.params;
    const { amount } = req.body;
    
    if (!phone_number) {
      return res.status(400).json({
        success: false,
        message: 'Phone number is required'
      });
    }
    
    if (!amount || amount <= 0) {
      return res.status(400).json({
        success: false,
        message: 'Valid amount greater than 0 is required'
      });
    }
    
    const result = await userService.adminDeductBalanceByPhone(phone_number, amount);
    
    res.status(200).json({
      success: true,
      message: result.message,
      data: result
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: error.message
    });
  }
};

const adminDeleteUserByPhone = async (req, res) => {
  try {
    const { phone_number } = req.params;
    
    if (!phone_number) {
      return res.status(400).json({
        success: false,
        message: 'Phone number is required'
      });
    }
    
    const result = await userService.adminDeleteUserByPhone(phone_number);
    
    res.status(200).json({
      success: true,
      message: result.message,
      data: result
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: error.message
    });
  }
};

// ============ EXPORT ALL FUNCTIONS ============
module.exports = {
  // Auth functions
  register,
  login,
  refreshToken,
  forgotPassword,
  resetPassword,
  changePasswordByPhone,
  
  // Payment functions - Mongike
  depositMoney,
  mongikeWebhook,        // NEW: For Mongike callbacks
  checkPaymentStatus,
  confirmDeposit,
  checkPendingPayments,
  manualConfirmDeposit,
  
  // Withdrawal functions - Snippe
  withdrawMoney,
  AdminWithdrawMoney,
  AdminWithdrawMoneyDb,
  
  // User functions
  checkBalance,
  getProfile,
  checkAdminStatus,
  
  // Admin functions
  adminGetAllUsers,
  adminGetUserByPhone,
  adminSetBalanceByPhone,
  adminAddBalanceByPhone,
  adminDeductBalanceByPhone,
  adminDeleteUserByPhone
};