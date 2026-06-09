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

    console.log('Initiating deposit for:', user.phone_number, 'amount:', amount);
    console.log('API Key exists:', !!process.env.HARAKAPAY_API_KEY);
    console.log('API Key length:', process.env.HARAKAPAY_API_KEY?.length);

    // Tuma ombi kwa HarakaPay - BILA webhook_url kwenye development
    const requestBody = {
      phone: user.phone_number,
      amount: Number(amount),
      description: 'Account deposit'
    };
    
    // Ongeza webhook_url tu kama ipo na sio localhost
    if (process.env.APP_URL && !process.env.APP_URL.includes('localhost')) {
      requestBody.webhook_url = `${process.env.APP_URL}/api/auth/haraka-webhook`;
      console.log('Webhook URL added:', requestBody.webhook_url);
    } else {
      console.log('No webhook URL sent (development mode)');
    }

    const response = await axios.post('https://harakapay.net/api/v1/collect', 
      requestBody,
      {
        headers: {
          'X-API-Key': process.env.HARAKAPAY_API_KEY,
          'Content-Type': 'application/json'
        }
      }
    );

    const result = response.data;
    console.log('HarakaPay response:', result);

    if (!result.success) {
      return res.status(400).json({
        message: result.message || 'Payment initiation failed',
        error: result.error
      });
    }


    if (!global.pendingPayments) {
      global.pendingPayments = new Map();
    }
    
    global.pendingPayments.set(result.order_id, {
      user_id: userId,
      amount: result.amount,
      net_amount: result.net_amount,
      status: 'pending',
      timestamp: Date.now()
    });

    res.status(200).json({
      message: 'Check your phone to complete payment. You will receive a prompt.',
      data: {
        order_id: result.order_id,
        amount: result.amount,
        net_amount: result.net_amount,
        fee: result.fee,
        status: 'pending'
      }
    });

  } catch (error) {
    console.error('Deposit error details:', {
      message: error.message,
      response: error.response?.data,
      status: error.response?.status,
      headers: error.response?.headers
    });
    
    // Handle specific error
    if (error.response?.data?.error === 'Invalid webhook_url') {
      return res.status(400).json({ 
        message: 'Webhook URL configuration error. Please try again without webhook or contact support.',
        note: 'Development mode: Try setting APP_URL to empty string in .env'
      });
    }
    
    res.status(500).json({ 
      message: error.response?.data?.message || 'Failed to initiate deposit. Please try again.',
      error: error.response?.data?.error
    });
  }
};


// auth.controller.js - Add this function
const checkPaymentStatus = async (req, res) => {
  try {
    const { order_id } = req.params;
    const userId = req.user.id;

    console.log('Checking payment status for order:', order_id);

    // Call HarakaPay API to check status
    const response = await axios.get(`https://harakapay.net/api/v1/status/${order_id}`, {
      headers: {
        'X-API-Key': process.env.HARAKAPAY_API_KEY
      }
    });

    const result = response.data;
    console.log('HarakaPay status response:', result);

    if (result.success && result.payment) {
      const payment = result.payment;
      
      // Kama payment imekamilika, ongeza balance
      if (payment.status === 'completed') {
        // Check kama tayari tumeongeza balance
        const pendingPayments = global.pendingPayments || new Map();
        const pendingPayment = pendingPayments.get(order_id);
        
        if (pendingPayment && !pendingPayment.balance_added) {
          // Get user
          const user = await userRepository.findById(userId);
          
          if (user) {
            // Add balance (use net_amount or amount)
            const amountToAdd = payment.net_amount || payment.amount;
            const currentBalance = parseFloat(user.balance) || 0;
            const newBalance = currentBalance + parseFloat(amountToAdd);
            
            // Update balance in database
            await userRepository.updateBalance(userId, newBalance);
            
            // Mark as added
            pendingPayment.balance_added = true;
            pendingPayments.set(order_id, pendingPayment);
            
            console.log(`Balance updated for user ${userId}: +${amountToAdd}`);
          }
        }
      }

      return res.status(200).json({
        success: true,
        data: payment
      });
    }

    res.status(200).json({
      success: false,
      message: 'Payment not found'
    });

  } catch (error) {
    console.error('Status check error:', {
      message: error.message,
      response: error.response?.data,
      status: error.response?.status
    });
    
    res.status(400).json({
      success: false,
      message: error.response?.data?.message || 'Failed to check status'
    });
  }
};


// auth.controller.js - Ongeza function hii chini kabla ya module.exports

const harakaWebhook = async (req, res) => {
  try {
    const {
      order_id,
      status,
      amount,
      net_amount,
      fee_amount,
      completed_at
    } = req.body;

    console.log('🔥 HarakaPay Webhook received:', { order_id, status, amount });

    // Verify API key (optional but recommended)
    const apiKey = req.headers['x-api-key'];
    if (apiKey !== process.env.HARAKAPAY_API_KEY) {
      console.log('Invalid API key');
      return res.sendStatus(200); // Still return 200 to prevent retries
    }

    if (status === 'completed') {
      console.log(`💰 Payment ${order_id} completed: TZS ${amount}`);
      
      // HAPA: Baadaye utaongeza balance kwa user
      // Kwa sasa, log tu
      
      // const user = await userRepository.findByOrderId(order_id);
      // await userRepository.addBalance(user.id, net_amount || amount);
    }

    // Always return 200 to HarakaPay
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
  harakaWebhook,
  checkPaymentStatus
};