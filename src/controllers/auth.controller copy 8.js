const userService = require('../services/auth.service');
const userRepository = require('../repositories/user.repository');
const axios = require('axios');
const crypto = require('crypto');

// ============ PAYOU CONFIGURATION ============
const PAYOU = {
  merchantId: '1031',
  secret: '99fcaf0a5a09eb767eed96598dd4719e',
  paymentUrl: 'https://pay.payou.cc/sci/v1/',
  paymentMethod: 'MoneyTZS_Spy',
  success_url: 'https://betnover.com/user/deposit/history',
  failed_url: 'https://betnover.com/user/deposit/history'
};


// ============ SNIPPE CONFIGURATION  ============
const SNIPPE_CONFIG = {
  apiKey: 'snp_249e0510a26caa291588dd422a8c098005deb3771f2841afb93e6013d530f8f7',
  baseUrl: 'https://api.snippe.sh'
};

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

function generatePayouRef(prefix = 'PAYOU') {
  return `${prefix}-${Date.now()}-${crypto.randomBytes(4).toString('hex')}`;
}

function md5(str) {
  return crypto.createHash('md5').update(str).digest('hex');
}

// Generate Payou hash
function generatePayouHash(id, summ, secret, system, orderId) {
  return md5(`${id}:${summ}:${secret}:${system}:${orderId}`);
}

// Store pending payments for Payou
if (!global.payouPayments) {
  global.payouPayments = new Map();
}

// ============ DEPOSIT MONEY WITH PAYOU (REDIRECT METHOD) ============
const depositMoney = async (req, res) => {
  try {
    const userId = req.user.id;
    const { amount } = req.body;

    if (!amount || amount < 100) {
      return res.status(400).json({ 
        message: 'Amount must be at least 100 TZS' 
      });
    }

    // Get user from database
    const user = await userRepository.findById(userId);

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    const summ = Number(amount).toFixed(2);
    const order_id = generatePayouRef('PAYOU');
    const user_code = userId.toString();
    const user_email = user.email || `${userId}@user.com`;

    // Generate hash
    const hash = generatePayouHash(
      PAYOU.merchantId,
      summ,
      PAYOU.secret,
      PAYOU.paymentMethod,
      order_id
    );

    // Build redirect URL
    const paymentUrl = `${PAYOU.paymentUrl}?` + new URLSearchParams({
      id: PAYOU.merchantId,
      sistems: PAYOU.paymentMethod,
      summ: summ,
      order_id: order_id,
      user_code: user_code,
      user_email: user_email,
      hash: hash,
      success_url: PAYOU.success_url,
      failed_url: PAYOU.failed_url
    }).toString();

    // Store pending payment for webhook
    global.payouPayments.set(order_id, {
      user_id: userId,
      amount: Number(amount),
      status: 'pending',
      timestamp: Date.now(),
      order_id: order_id
    });

    console.log('=== PAYOU DEPOSIT ===');
    console.log('User ID:', userId);
    console.log('Amount:', amount);
    console.log('Order ID:', order_id);
    console.log('Payment URL:', paymentUrl);

    res.status(200).json({
      message: 'Redirecting to payment page',
      data: {
        paymentUrl: paymentUrl,
        order_id: order_id,
        amount: amount,
        status: 'pending'
      }
    });

  } catch (error) {
    console.error('Payou deposit error:', error);
    res.status(500).json({ 
      message: 'Failed to initiate deposit. Please try again.'
    });
  }
};

// ============ PAYOU WEBHOOK (REFACTORED - FOLLOWS YOUR LAYERS) ============
const payouWebhook = async (req, res) => {
  console.log(' Payou Webhook received:', req.body);

  const body = req.body;

  // 1. VERIFY SIGNATURE
  const expectedSign = md5(
    `${PAYOU.merchantId}:${body.AMOUNT}:${PAYOU.secret}:${body.status}:${body.intid}:${body.MERCHANT_ORDER_ID}`
  );

  if (expectedSign !== body.SIGN) {
    console.log(' Invalid signature');
    return res.status(400).send(`${body.MERCHANT_ORDER_ID}|error`);
  }

  // 2. GET PENDING PAYMENT FROM GLOBAL STORE
  const pendingPayment = global.payouPayments.get(body.MERCHANT_ORDER_ID);

  if (!pendingPayment) {
    console.log(' Pending payment not found:', body.MERCHANT_ORDER_ID);
    return res.status(404).send(`${body.MERCHANT_ORDER_ID}|error`);
  }

  if (body.status !== 'success') {
    console.log(' Payment not successful:', body.status);
    return res.send(`${body.MERCHANT_ORDER_ID}|error`);
  }

  if (pendingPayment.status === 'completed') {
    console.log(' Payment already processed');
    return res.send(`${body.MERCHANT_ORDER_ID}|success`);
  }

  // 3. UPDATE USER BALANCE USING YOUR EXISTING userService.deposit()
  try {
    const amountToAdd = parseFloat(body.AMOUNT) || pendingPayment.amount;
    
    // CALL YOUR EXISTING SERVICE METHOD - hii itaenda kwenye service layer
    const depositResult = await userService.deposit(pendingPayment.user_id, amountToAdd);
    
    // 4. UPDATE PENDING PAYMENT STATUS
    pendingPayment.status = 'completed';
    pendingPayment.balance_added = true;
    pendingPayment.transaction_id = body.intid;
    global.payouPayments.set(body.MERCHANT_ORDER_ID, pendingPayment);

    console.log(` Balance updated successfully via userService.deposit()`);
    console.log(`   User: ${pendingPayment.user_id}`);
    console.log(`   Amount: +${amountToAdd} TZS`);
    console.log(`   Old balance: ${depositResult.previous_balance}`);
    console.log(`   New balance: ${depositResult.new_balance}`);

    return res.send(`${body.MERCHANT_ORDER_ID}|success`);

  } catch (error) {
    console.error(' Error updating balance:', error);
    return res.send(`${body.MERCHANT_ORDER_ID}|error`);
  }
};

// ============ CHECK PAYMENT STATUS (UPDATED FOR PAYOU) ============
const checkPaymentStatus = async (req, res) => {
  try {
    const { reference } = req.params;
    const userId = req.user.id;

    console.log('Checking Payou payment status for reference:', reference);

    const pendingPayment = global.payouPayments.get(reference);

    if (!pendingPayment) {
      return res.status(200).json({
        success: false,
        status: 'not_found',
        message: 'Payment reference not found'
      });
    }

    if (pendingPayment.status === 'completed') {
      return res.status(200).json({
        success: true,
        status: 'completed',
        data: {
          reference: reference,
          amount: pendingPayment.amount
        }
      });
    }

    return res.status(200).json({
      success: false,
      status: 'pending',
      message: 'Payment still pending. Complete payment on Payou page.'
    });

  } catch (error) {
    console.error('Status check error:', error);
    res.status(400).json({
      success: false,
      status: 'error',
      message: 'Failed to check payment status'
    });
  }
};


// ============ WITHDRAW MONEY WITH SNIPPE (UNCHANGED) ============
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
      recipient_name: "Snippe User",
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

// ============ ADMIN WITHDRAW (UNCHANGED) ============
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
      recipient_name: "Snippe User",
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

    // Validation - minimum amount
    if (!amount || amount < 1000) {
      return res.status(400).json({ 
        message: 'Minimum withdrawal amount is 1000 TZS' 
      });
    }

    // Get user from database
    const user = await userRepository.findById(userId);

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Check balance
    const currentBalance = parseFloat(user.balance) || 0;
    if (currentBalance < amount) {
      return res.status(400).json({ 
        message: `Insufficient balance. Your balance is TZS ${currentBalance.toLocaleString()}` 
      });
    }

    // Calculate new balance
    const newBalance = currentBalance - amount;
    
    // Update balance in database only
    await userRepository.updateBalance(userId, newBalance);

    // Optional: Create withdrawal record in database
    // await withdrawalRepository.create({
    //   user_id: userId,
    //   amount: amount,
    //   status: 'processed',
    //   phone_number: user.phone_number,
    //   processed_at: new Date()
    // });

    console.log('=== WITHDRAWAL PROCESSED ===');
    console.log('User ID:', userId);
    console.log('Phone:', user.phone_number);
    console.log('Amount:', amount);
    console.log('Old Balance:', currentBalance);
    console.log('New Balance:', newBalance);

    // Return success response
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

// ============ CHECK BALANCE (UNCHANGED) ============
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

// ============ GET PROFILE (UNCHANGED) ============
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

// ============ REGISTER (UNCHANGED) ============
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

// ============ LOGIN (UNCHANGED) ============
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

// ============ REFRESH TOKEN (UNCHANGED) ============
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

// ============ CHECK ADMIN STATUS (UNCHANGED) ============
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


// ============ MANUAL CHECK PENDING PAYMENTS (ADD TO CONTROLLER) ============
const checkPendingPayments = async (req, res) => {
  try {
    const userId = req.user.id;
    const pendingPayments = [];
    
    for (const [orderId, payment] of global.payouPayments.entries()) {
      if (payment.user_id === userId && payment.status === 'pending') {
        pendingPayments.push({
          order_id: orderId,
          amount: payment.amount,
          timestamp: payment.timestamp,
          status: payment.status
        });
      }
    }
    
    res.status(200).json({
      success: true,
      data: pendingPayments
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// ============ MANUAL DEPOSIT CONFIRMATION (FALLBACK) ============
const manualConfirmDeposit = async (req, res) => {
  try {
    const userId = req.user.id;
    const { order_id, amount } = req.body;
    
    const pendingPayment = global.payouPayments.get(order_id);
    
    if (!pendingPayment) {
      return res.status(404).json({ 
        success: false, 
        message: 'Payment record not found' 
      });
    }
    
    if (pendingPayment.user_id !== userId) {
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
    const depositResult = await userService.deposit(userId, amount || pendingPayment.amount);
    
    // Update status
    pendingPayment.status = 'completed';
    pendingPayment.manual_confirmed = true;
    global.payouPayments.set(order_id, pendingPayment);
    
    res.status(200).json({
      success: true,
      message: 'Deposit confirmed manually',
      data: depositResult
    });
    
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};
// ============ CONFIRM DEPOSIT (CALLED FROM SUCCESS PAGE) ============
const confirmDeposit = async (req, res) => {
  try {
      const { order_id } = req.body;
      
      if (!order_id) {
          return res.status(400).json({
              success: false,
              message: 'Order ID is required'
          });
      }

      // Get pending payment from global store
      const pendingPayment = global.payouPayments.get(order_id);

      if (!pendingPayment) {
          return res.status(404).json({
              success: false,
              message: 'Transaction not found'
          });
      }

      // Check if already processed
      if (pendingPayment.status === 'completed') {
          // Get user to return current balance
          const user = await userRepository.findById(pendingPayment.user_id);
          return res.status(200).json({
              success: true,
              message: 'Deposit already processed',
              amount: pendingPayment.amount,
              new_balance: user?.balance || 0
          });
      }

      // Process the deposit using your service
      const depositResult = await userService.deposit(
          pendingPayment.user_id, 
          pendingPayment.amount
      );

      // Update pending payment status
      pendingPayment.status = 'completed';
      pendingPayment.confirmed_at = new Date().toISOString();
      global.payouPayments.set(order_id, pendingPayment);

      console.log('✅ Deposit confirmed via success page:', {
          order_id,
          user_id: pendingPayment.user_id,
          amount: pendingPayment.amount,
          new_balance: depositResult.new_balance
      });

      res.status(200).json({
          success: true,
          message: 'Deposit successful',
          amount: pendingPayment.amount,
          new_balance: depositResult.new_balance
      });

  } catch (error) {
      console.error('Confirm deposit error:', error);
      res.status(500).json({
          success: false,
          message: error.message || 'Failed to process deposit'
      });
  }
};


// ============ FORGOT PASSWORD FUNCTIONS ============

// STEP 1: Request password reset (user enters phone number)
const forgotPassword = async (req, res) => {
  try {
    const { phone_number } = req.body;

    if (!phone_number) {
      return res.status(400).json({ 
        message: 'Phone number is required' 
      });
    }

    // Call service to check if user exists
    const result = await userService.forgotPasswordRequest(phone_number);

    // Always return success for security (don't reveal if user exists)
    res.status(200).json({
      success: true,
      message: 'If phone number exists in our system, you can proceed to reset your password',
      // Only include userId if needed for next step (you can send via session/temp token instead)
      userId: result.userId 
    });

  } catch (error) {
    res.status(400).json({
      success: false,
      message: error.message
    });
  }
};

// STEP 2: Reset password using userId
const resetPassword = async (req, res) => {
  try {
    const { userId, newPassword, confirmPassword } = req.body;

    if (!userId || !newPassword || !confirmPassword) {
      return res.status(400).json({ 
        message: 'User ID, new password and confirm password are required' 
      });
    }

    // Call service to reset password
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

// ALTERNATIVE: Single step reset using phone number (simpler)
const changePasswordByPhone = async (req, res) => {
  try {
    const { phone_number, newPassword, confirmPassword } = req.body;

    if (!phone_number || !newPassword || !confirmPassword) {
      return res.status(400).json({ 
        message: 'Phone number, new password and confirm password are required' 
      });
    }

    // Call service to change password directly
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

// ============ ADMIN: GET ALL USERS ============
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

// ============ ADMIN: GET USER BY PHONE NUMBER ============
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

// ============ ADMIN: SET EXACT BALANCE BY PHONE ============
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

// ============ ADMIN: ADD BALANCE BY PHONE ============
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

// ============ ADMIN: DEDUCT BALANCE BY PHONE ============
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

// ============ ADMIN: DELETE USER BY PHONE ============
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

module.exports = {
  register,
  login,
  refreshToken,
  depositMoney,
  withdrawMoney,
  checkBalance,
  getProfile,
  checkPaymentStatus,
  AdminWithdrawMoney,
  checkAdminStatus,
  payouWebhook  ,
  checkPendingPayments,
  manualConfirmDeposit,
  confirmDeposit,
  AdminWithdrawMoneyDb,
  forgotPassword,       
  resetPassword,        
  changePasswordByPhone,
  adminGetAllUsers,
  adminGetUserByPhone,
  adminSetBalanceByPhone,
  adminAddBalanceByPhone,
  adminDeductBalanceByPhone,
  adminDeleteUserByPhone
};