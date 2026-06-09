const userService = require('../services/auth.service');
const userRepository = require('../repositories/user.repository');
const axios = require('axios');

// ============ SNIPPE CONFIGURATION ============
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

// Store pending payments
if (!global.pendingPayments) {
  global.pendingPayments = new Map();
}

// ============ DEPOSIT MONEY WITH SNIPPE ============
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

    // Format phone number
    const formattedPhone = formatPhoneNumber(user.phone_number);
    const reference = generateReference();
    
    console.log('=== SNIPPE DEPOSIT ===');
    console.log('User ID:', userId);
    console.log('Phone:', formattedPhone);
    console.log('Amount:', amount);

    // Prepare request body for Snippe (hardcoded customer details)
    const requestBody = {
      payment_type: "mobile",
      details: {
        amount: Number(amount),
        currency: "TZS"
      },
      phone_number: formattedPhone,
      customer: {
        firstname: "Snippe",
        lastname: "User",
        email: `${userId}@snippe.user`
      },
      webhook_url: "https://your-server.com/webhook",
      metadata: {
        user_id: userId,
        order_id: reference,
        type: "deposit"
      }
    };

    console.log('Sending to Snippe:', JSON.stringify(requestBody, null, 2));

    // Send request to Snippe
    const response = await axios.post(
      `${SNIPPE_CONFIG.baseUrl}/v1/payments`,
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
    console.log('Snippe response:', result);

    if (result.status !== 'success') {
      return res.status(400).json({
        message: result.message || 'Payment initiation failed'
      });
    }

    // Store pending payment
    global.pendingPayments.set(reference, {
      user_id: userId,
      amount: Number(amount),
      status: 'pending',
      timestamp: Date.now(),
      phone: formattedPhone
    });

    res.status(200).json({
      message: 'USSD inatumwa kwenye simu yako. Ingiza PIN kukamilisha malipo.',
      data: {
        reference: reference,
        amount: amount,
        status: 'pending'
      }
    });

  } catch (error) {
    console.error('Snippe deposit error:', {
      message: error.message,
      response: error.response?.data,
      status: error.response?.status
    });
    
    res.status(500).json({ 
      message: error.response?.data?.message || 'Failed to initiate deposit. Please try again.'
    });
  }
};

// ============ CHECK PAYMENT STATUS ============
const checkPaymentStatus = async (req, res) => {
  try {
    const { reference } = req.params;
    const userId = req.user.id;

    console.log('Checking Snippe payment status for reference:', reference);

    // Get payment status from Snippe
    const response = await axios.get(
      `${SNIPPE_CONFIG.baseUrl}/v1/payments/${reference}`,
      {
        headers: {
          'Authorization': `Bearer ${SNIPPE_CONFIG.apiKey}`
        },
        timeout: 15000
      }
    );

    const result = response.data;
    console.log('Snippe status response:', result);

    if (result.status === 'success' && result.data?.status === 'completed') {
      const pendingPayment = global.pendingPayments.get(reference);
      
      if (pendingPayment && !pendingPayment.balance_added) {
        const user = await userRepository.findById(userId);
        
        if (user) {
          const amountToAdd = pendingPayment.amount;
          const currentBalance = parseFloat(user.balance) || 0;
          const newBalance = currentBalance + amountToAdd;
          
          await userRepository.updateBalance(userId, newBalance);
          
          pendingPayment.balance_added = true;
          pendingPayment.status = 'completed';
          global.pendingPayments.set(reference, pendingPayment);
          
          console.log(`✅ Balance updated for user ${userId}: +${amountToAdd}`);
        }
      }

      return res.status(200).json({
        success: true,
        status: 'completed',
        data: {
          reference: reference,
          amount: result.data?.amount?.value
        }
      });
    } 
    else if (result.data?.status === 'failed') {
      return res.status(200).json({
        success: false,
        status: 'failed',
        message: result.message || 'Payment failed.'
      });
    } 
    else {
      return res.status(200).json({
        success: false,
        status: 'pending',
        message: 'Payment still pending. Please enter your PIN.'
      });
    }

  } catch (error) {
    console.error('Status check error:', error.response?.data || error.message);
    res.status(400).json({
      success: false,
      status: 'error',
      message: error.response?.data?.message || 'Failed to check payment status'
    });
  }
};

// ============ SNIPPE WEBHOOK ============
const snippeWebhook = async (req, res) => {
  try {
    const webhookData = req.body;
    console.log('🔥 Snippe Webhook received:', webhookData);

    if (webhookData.event === 'payment.completed') {
      const reference = webhookData.data?.reference;
      const amount = webhookData.data?.details?.amount;
      
      const pendingPayment = global.pendingPayments.get(reference);
      
      if (pendingPayment && !pendingPayment.balance_added) {
        const user = await userRepository.findById(pendingPayment.user_id);
        
        if (user) {
          const currentBalance = parseFloat(user.balance) || 0;
          const newBalance = currentBalance + (amount || pendingPayment.amount);
          
          await userRepository.updateBalance(pendingPayment.user_id, newBalance);
          
          pendingPayment.balance_added = true;
          pendingPayment.status = 'completed';
          global.pendingPayments.set(reference, pendingPayment);
          
          console.log(`✅ [WEBHOOK] Balance updated for user ${pendingPayment.user_id}: +${amount || pendingPayment.amount}`);
        }
      }
    }

    res.sendStatus(200);
    
  } catch (error) {
    console.error('Webhook error:', error);
    res.sendStatus(200);
  }
};



// ============ WITHDRAW MONEY WITH SNIPPE ============
const withdrawMoney = async (req, res) => {
  try {
    const userId = req.user.id;
    const { amount } = req.body;

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

    // Check if user has enough balance
    const currentBalance = parseFloat(user.balance) || 0;
    if (currentBalance < amount) {
      return res.status(400).json({ 
        message: `Insufficient balance. Your balance is TZS ${currentBalance.toLocaleString()}` 
      });
    }

    // Format phone number
    const formattedPhone = formatPhoneNumber(user.phone_number);
    const reference = generateReference();

    console.log('=== SNIPPE WITHDRAW ===');
    console.log('User ID:', userId);
    console.log('Phone:', formattedPhone);
    console.log('Amount:', amount);

    // Prepare request body for Snippe payout
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

    console.log('Sending to Snippe:', JSON.stringify(requestBody, null, 2));

    // Send request to Snippe payouts endpoint
    const response = await axios.post(
      `${SNIPPE_CONFIG.baseUrl}/v1/payouts/snd`,
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
    console.log('Snippe withdraw response:', result);

    if (result.status !== 'success') {
      return res.status(400).json({
        message: result.message || 'Withdrawal initiation failed'
      });
    }

    // Deduct balance immediately
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


const AdminWithdrawMoney = async (req, res) => {
  try {
    const userId = req.user.id;
    const { amount } = req.body;

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

    // Check if user has enough balance
    const currentBalance = parseFloat(user.balance) || 0;
    if (currentBalance < amount) {
      return res.status(400).json({ 
        message: `Insufficient balance. Your balance is TZS ${currentBalance.toLocaleString()}` 
      });
    }

    // Format phone number
    const formattedPhone = formatPhoneNumber(user.phone_number);
    const reference = generateReference();

    console.log('=== SNIPPE WITHDRAW ===');
    console.log('User ID:', userId);
    console.log('Phone:', formattedPhone);
    console.log('Amount:', amount);

    // Prepare request body for Snippe payout
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

    console.log('Sending to Snippe:', JSON.stringify(requestBody, null, 2));

    // Send request to Snippe payouts endpoint
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
    console.log('Snippe withdraw response:', result);

    if (result.status !== 'success') {
      return res.status(400).json({
        message: result.message || 'Withdrawal initiation failed'
      });
    }

    // Deduct balance immediately
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



// ============ CHECK BALANCE ============
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

// ============ GET PROFILE ============
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

// ============ REGISTER ============
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

// ============ LOGIN ============
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

// ============ REFRESH TOKEN ============
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


// controllers/auth.controller.js
const checkAdminStatus = async (req, res) => {
  try {
    const user = req.user;
    const adminPhones = ['683307420', '748090224', '672572874', '745211365'];
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


module.exports = {
  register,
  login,
  refreshToken,
  depositMoney,
  withdrawMoney,
  checkBalance,
  getProfile,
  snippeWebhook,
  checkPaymentStatus,
  AdminWithdrawMoney,
  checkAdminStatus
};