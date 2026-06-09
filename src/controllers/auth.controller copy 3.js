const userService = require('../services/auth.service');
const axios = require('axios');

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



const userRepository = require('../repositories/user.repository'); 




// ============ MZALENDOPAY CONFIGURATION ============
const MZALENDO_CONFIG = {
  publicKey: 'MZ-deb9c0dac868',      
  secretKey: '2e5151b16416d9899bf4e9e88689f8a87fda76930b45b44a',
  baseUrl: 'https://mzalendopay.com/apiv2/'
};

// Helper function to format phone number for MzalendoPay
function formatPhoneForMzalendo(phone) {
  // Remove any non-digit characters
  let cleaned = phone.replace(/\D/g, '');
  
  // If starts with 0, replace with 255
  if (cleaned.startsWith('0')) {
    cleaned = '255' + cleaned.substring(1);
  }
  
  // If doesn't start with 255, add it
  if (!cleaned.startsWith('255')) {
    cleaned = '255' + cleaned;
  }
  
  return cleaned;
}

// ============ DEPOSIT MONEY WITH MZALENDOPAY ============
const depositMoney = async (req, res) => {
  try {
    const userId = req.user.id;
    const { amount } = req.body;

    if (!amount || amount < 100) {
      return res.status(400).json({ 
        message: 'Amount must be at least 100 TZS' 
      });
    }

    // Pata user kutoka database
    const user = await userRepository.findById(userId);

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Format phone number for MzalendoPay
    const formattedPhone = formatPhoneForMzalendo(user.phone_number);
    
    console.log('=== MZALENDOPAY DEPOSIT ===');
    console.log('User ID:', userId);
    console.log('Original phone:', user.phone_number);
    console.log('Formatted phone:', formattedPhone);
    console.log('Amount:', amount);

    // Prepare request body for MzalendoPay
    const requestBody = {
      customer_name: user.name || 'Customer',
      customer_email: user.email || 'customer@example.com',
      customer_phone: formattedPhone,
      amount: Number(amount),
      description: 'Account deposit'
    };

    console.log('Sending to MzalendoPay:', requestBody);

    // Tuma ombi kwa MzalendoPay
    const response = await axios.post(
      `${MZALENDO_CONFIG.baseUrl}create_payment.php`,
      requestBody,
      {
        headers: {
          'X-PUBLIC-KEY': MZALENDO_CONFIG.publicKey,
          'X-SECRET-KEY': MZALENDO_CONFIG.secretKey,
          'Content-Type': 'application/json'
        },
        timeout: 30000
      }
    );

    const result = response.data;
    console.log('MzalendoPay response:', result);

    if (!result.success) {
      return res.status(400).json({
        message: result.message || 'Payment initiation failed',
        error: result.error
      });
    }

    // Store pending payment
    if (!global.pendingPayments) {
      global.pendingPayments = new Map();
    }
    
    global.pendingPayments.set(result.order_id, {
      user_id: userId,
      amount: Number(amount),
      payment_id: result.payment_id,
      status: 'pending',
      timestamp: Date.now(),
      phone: formattedPhone
    });

    res.status(200).json({
      message: result.message || 'Check your phone to complete payment. You will receive a USSD prompt.',
      data: {
        order_id: result.order_id,
        payment_id: result.payment_id,
        amount: amount,
        status: 'pending'
      }
    });

  } catch (error) {
    console.error('MzalendoPay deposit error:', {
      message: error.message,
      response: error.response?.data,
      status: error.response?.status
    });
    
    res.status(500).json({ 
      message: error.response?.data?.message || 'Failed to initiate deposit. Please try again.',
      error: error.response?.data?.error || error.message
    });
  }
};

// ============ CHECK PAYMENT STATUS WITH MZALENDOPAY ============
const checkPaymentStatus = async (req, res) => {
  try {
    const { order_id } = req.params;
    const userId = req.user.id;

    console.log('Checking MzalendoPay payment status for order:', order_id);

    // Call MzalendoPay API to check status
    const response = await axios.get(
      `${MZALENDO_CONFIG.baseUrl}check_payment_status.php?order_id=${order_id}`,
      {
        headers: {
          'X-PUBLIC-KEY': MZALENDO_CONFIG.publicKey,
          'X-SECRET-KEY': MZALENDO_CONFIG.secretKey
        },
        timeout: 15000
      }
    );

    const result = response.data;
    console.log('MzalendoPay status response:', result);

    if (result.success && result.status === 'SUCCESS') {
      // Payment completed successfully
      const pendingPayments = global.pendingPayments || new Map();
      const pendingPayment = pendingPayments.get(order_id);
      
      if (pendingPayment && !pendingPayment.balance_added) {
        // Get user
        const user = await userRepository.findById(userId);
        
        if (user) {
          // Add balance
          const amountToAdd = parseFloat(result.amount) || pendingPayment.amount;
          const currentBalance = parseFloat(user.balance) || 0;
          const newBalance = currentBalance + amountToAdd;
          
          // Update balance in database
          await userRepository.updateBalance(userId, newBalance);
          
          // Mark as added
          pendingPayment.balance_added = true;
          pendingPayment.status = 'completed';
          pendingPayment.transid = result.transid;
          pendingPayments.set(order_id, pendingPayment);
          
          console.log(`✅ Balance updated for user ${userId}: +${amountToAdd}`);
          console.log(`   Transaction ID: ${result.transid}`);
        }
      }

      return res.status(200).json({
        success: true,
        status: 'completed',
        data: {
          order_id: order_id,
          transid: result.transid,
          amount: result.amount
        }
      });
    } else if (result.status === 'FAILED') {
      return res.status(200).json({
        success: false,
        status: 'failed',
        message: result.message || 'Payment failed'
      });
    } else {
      // Still pending
      return res.status(200).json({
        success: false,
        status: 'pending',
        message: result.message || 'Payment still pending'
      });
    }

  } catch (error) {
    console.error('Status check error:', {
      message: error.message,
      response: error.response?.data,
      status: error.response?.status
    });
    
    res.status(400).json({
      success: false,
      status: 'error',
      message: error.response?.data?.message || 'Failed to check payment status'
    });
  }
};

// ============ MZALENDOPAY WEBHOOK ============
const mzalendoWebhook = async (req, res) => {
  try {
    const webhookData = req.body;
    console.log('🔥 MzalendoPay Webhook received:', webhookData);

    const { event, order_id, status, amount, transid, timestamp } = webhookData;

    // Verify it's a payment success event
    if (event === 'payment.success' && status === 'SUCCESS') {
      const pendingPayments = global.pendingPayments || new Map();
      const pendingPayment = pendingPayments.get(order_id);
      
      if (pendingPayment && !pendingPayment.balance_added) {
        // Get user from pending payment
        const user = await userRepository.findById(pendingPayment.user_id);
        
        if (user) {
          // Add balance
          const amountToAdd = parseFloat(amount) || pendingPayment.amount;
          const currentBalance = parseFloat(user.balance) || 0;
          const newBalance = currentBalance + amountToAdd;
          
          // Update balance in database
          await userRepository.updateBalance(pendingPayment.user_id, newBalance);
          
          // Mark as added
          pendingPayment.balance_added = true;
          pendingPayment.status = 'completed';
          pendingPayment.transid = transid;
          pendingPayments.set(order_id, pendingPayment);
          
          console.log(`✅ [WEBHOOK] Balance updated for user ${pendingPayment.user_id}: +${amountToAdd}`);
          console.log(`   Transaction ID: ${transid}`);
        }
      }
    }

    // Always return 200 to acknowledge receipt
    res.sendStatus(200);
    
  } catch (error) {
    console.error('Webhook error:', error);
    res.sendStatus(200); // Still return 200 to prevent retries
  }
};



const withdrawMoney = async (req, res) => {
  try {
    const userId = req.user.id; // From auth middleware
    const { amount } = req.body;

    if (!amount) {
      return res.status(400).json({ 
        message: 'Amount is required' 
      });
    }

    const result = await userService.withdraw(userId, amount);

    res.status(200).json({
      message: 'Withdrawal successful',
      data: result
    });

  } catch (error) {
    res.status(400).json({ 
      message: error.message 
    });
  }
};

const checkBalance = async (req, res) => {
  try {
    const userId = req.user.id; // From auth middleware

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

const getProfile = async (req, res) => {
  try {
    const userId = req.user.id; // From auth middleware
    const user = await userService.getProfile(userId); // You need to create this in service
    
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

module.exports = {
  refreshToken,
  register,
  login,
  depositMoney,
  withdrawMoney,
  checkBalance,
  getProfile,
  mzalendoWebhook,
  checkPaymentStatus
};