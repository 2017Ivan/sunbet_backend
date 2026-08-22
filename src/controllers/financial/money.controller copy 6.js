// controllers/financial/snippe.controller.js
const userService = require('../../services/auth.service');
const userRepository = require('../../repositories/user.repository');
const axios = require('axios');
const crypto = require('crypto');

// ============ SNIPPE CONFIGURATION ============
const SNIPPE = {
  apiKey: 'snp_your_api_key_here', // Replace with your actual Snippe API key
  baseUrl: 'https://api.snippe.sh/v1',
  webhookSecret: 'whsec_your_webhook_secret_here', // Replace with your webhook secret
};

// Store pending transactions (in memory - use Redis/DB in production)
if (!global.snippeTransactions) {
  global.snippeTransactions = new Map();
}

// ============ HELPERS ============
function generateTransactionId() {
  return `TXN${Date.now()}${crypto.randomBytes(4).toString('hex').toUpperCase()}`;
}

function formatPhoneForSnippe(phone) {
  // Snippe expects phone in format: 255XXXXXXXXX (no leading +)
  let cleaned = phone.replace(/\D/g, '');
  
  // If starts with 0, remove it and add 255
  if (cleaned.startsWith('0')) {
    cleaned = '255' + cleaned.substring(1);
  }
  
  // If starts with +255, remove the +
  if (cleaned.startsWith('255') && cleaned.length === 12) {
    return cleaned;
  }
  
  return cleaned;
}

// ============ SNIPPE DEPOSIT (Mobile Money) ============

/**
 * POST /api/deposit/snippe - Initiate Snippe mobile money deposit
 */
const depositViaSnippe = async (req, res) => {
  try {
    const userId = req.user.id;
    const { amount, phone_number } = req.body;

    // Validate amount (minimum 500 TZS)
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

    // Format phone for Snippe
    const snippePhone = formatPhoneForSnippe(phone_number);
    const transactionId = generateTransactionId();

    // Build Snippe request
    const requestData = {
      payment_type: "mobile",
      details: {
        amount: Number(amount),
        currency: "TZS"
      },
      phone_number: snippePhone,
      customer: {
        firstname: user.first_name || 'Customer',
        lastname: user.last_name || 'User',
        email: user.email || 'customer@example.com'
      },
      webhook_url: `${process.env.BASE_URL || 'https://sunbeting.com'}/api/snippe-webhook`,
      metadata: {
        user_id: userId,
        transaction_id: transactionId,
        internal_reference: transactionId
      }
    };

    console.log('📤 Snippe Deposit Request:', JSON.stringify(requestData, null, 2));

    // Call Snippe API
    const response = await axios.post(
      `${SNIPPE.baseUrl}/payments`,
      requestData,
      {
        headers: {
          'Authorization': `Bearer ${SNIPPE.apiKey}`,
          'Content-Type': 'application/json',
          'Accept': 'application/json',
          'Idempotency-Key': transactionId.substring(0, 30) // Max 30 chars
        },
        timeout: 30000
      }
    );

    const result = response.data;
    console.log('✅ Snippe Response:', JSON.stringify(result, null, 2));

    if (result.status === 'success' && result.data) {
      const paymentData = result.data;
      
      // Store transaction
      global.snippeTransactions.set(transactionId, {
        user_id: userId,
        amount: Number(amount),
        phone: snippePhone,
        status: 'pending',
        snippe_reference: paymentData.reference,
        created_at: new Date().toISOString(),
        expires_at: paymentData.expires_at
      });

      return res.status(200).json({
        success: true,
        message: 'Payment initiated. Check your phone for the USSD push notification.',
        data: {
          transaction_id: transactionId,
          snippe_reference: paymentData.reference,
          amount: amount,
          phone: snippePhone,
          status: 'pending',
          expires_at: paymentData.expires_at
        }
      });
    } else {
      throw new Error(result.message || 'Failed to initiate payment');
    }

  } catch (error) {
    console.error('❌ Snippe deposit error:', error);

    let errorMessage = 'Failed to initiate payment';
    
    if (error.response?.data) {
      console.error('Snippe Error:', JSON.stringify(error.response.data, null, 2));
      errorMessage = error.response.data.message || 
                    error.response.data.error_code || 
                    errorMessage;
    } else if (error.message) {
      errorMessage = error.message;
    }

    res.status(500).json({
      success: false,
      message: errorMessage
    });
  }
};

// ============ SNIPPE WEBHOOK ============

/**
 * POST /api/snippe-webhook - Snippe webhook handler
 */
const snippeWebhook = async (req, res) => {
  console.log('🔥 Snippe Webhook received:', JSON.stringify(req.body, null, 2));

  try {
    // Verify webhook signature (recommended for production)
    const signature = req.headers['x-webhook-signature'];
    const timestamp = req.headers['x-webhook-timestamp'];
    
    if (SNIPPE.webhookSecret && signature && timestamp) {
      // Verify signature
      const rawBody = JSON.stringify(req.body);
      const message = `${timestamp}.${rawBody}`;
      const expectedSignature = crypto
        .createHmac('sha256', SNIPPE.webhookSecret)
        .update(message)
        .digest('hex');
      
      // Constant-time comparison
      if (!crypto.timingSafeEqual(
        Buffer.from(signature),
        Buffer.from(expectedSignature)
      )) {
        console.error('❌ Invalid webhook signature');
        return res.status(400).json({ error: 'Invalid signature' });
      }
      
      // Check timestamp freshness (reject if > 5 minutes old)
      const eventTime = parseInt(timestamp, 10);
      const currentTime = Math.floor(Date.now() / 1000);
      if (currentTime - eventTime > 300) {
        console.error('❌ Webhook timestamp too old');
        return res.status(400).json({ error: 'Timestamp too old' });
      }
    }

    const webhookData = req.body;
    const eventType = webhookData.type || webhookData.event;
    const eventData = webhookData.data || webhookData;

    // Handle different event types
    if (eventType === 'payment.completed' || eventType === 'payment.completed' || 
        (eventData.status && eventData.status === 'completed')) {
      
      const snippeReference = eventData.reference;
      
      // Find transaction by snippe_reference
      let foundTransaction = null;
      let foundKey = null;

      for (const [key, value] of global.snippeTransactions.entries()) {
        if (value.snippe_reference === snippeReference) {
          foundTransaction = value;
          foundKey = key;
          break;
        }
      }

      if (!foundTransaction) {
        console.log(`Transaction not found for snippe_reference: ${snippeReference}`);
        return res.status(200).json({ message: 'Transaction not found' });
      }

      // Prevent duplicate processing
      if (foundTransaction.status === 'completed') {
        console.log(`Transaction ${foundKey} already processed`);
        return res.status(200).json({ message: 'Already processed' });
      }

      // Extract amount from webhook (amount is object in webhook)
      let amount = foundTransaction.amount;
      if (eventData.amount && eventData.amount.value) {
        amount = eventData.amount.value;
      }
      
      // Update user balance
      const depositResult = await userService.deposit(foundTransaction.user_id, amount);

      // Update transaction
      foundTransaction.status = 'completed';
      foundTransaction.balance_added = true;
      foundTransaction.new_balance = depositResult.new_balance;
      foundTransaction.completed_at = new Date().toISOString();
      
      if (eventData.settlement) {
        foundTransaction.fees = eventData.settlement.fees;
        foundTransaction.gross = eventData.settlement.gross;
        foundTransaction.net = eventData.settlement.net;
      }
      
      if (eventData.channel) {
        foundTransaction.channel = eventData.channel;
      }

      global.snippeTransactions.set(foundKey, foundTransaction);

      console.log(`✅ Balance updated: +${amount} TZS for user ${foundTransaction.user_id}`);
      console.log(`💰 New balance: ${depositResult.new_balance}`);

    } else if (eventType === 'payment.failed' || eventType === 'payment.failed' ||
               (eventData.status && eventData.status === 'failed')) {
      
      const snippeReference = eventData.reference;
      
      for (const [key, value] of global.snippeTransactions.entries()) {
        if (value.snippe_reference === snippeReference) {
          value.status = 'failed';
          value.failure_reason = eventData.failure_reason || 'Payment failed';
          value.updated_at = new Date().toISOString();
          global.snippeTransactions.set(key, value);
          console.log(`❌ Payment ${key} failed: ${value.failure_reason}`);
          break;
        }
      }
    }

    res.status(200).json({
      message: 'Webhook received',
      status: 'success'
    });

  } catch (error) {
    console.error('❌ Webhook processing error:', error);
    // Still return 200 to prevent Snippe from retrying
    res.status(200).json({
      message: 'Webhook received with errors',
      status: 'error'
    });
  }
};

// ============ CHECK SNIPPE PAYMENT STATUS ============

/**
 * GET /api/payment/status/snippe/:transactionId - Check Snippe payment status
 */
const checkSnippeStatus = async (req, res) => {
  try {
    const { transactionId } = req.params;
    const userId = req.user.id;

    const transaction = global.snippeTransactions.get(transactionId);

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

    // If status is still pending, check with Snippe API directly
    if (transaction.status === 'pending' && transaction.snippe_reference) {
      try {
        const response = await axios.get(
          `${SNIPPE.baseUrl}/payments/${transaction.snippe_reference}`,
          {
            headers: {
              'Authorization': `Bearer ${SNIPPE.apiKey}`,
              'Accept': 'application/json'
            },
            timeout: 10000
          }
        );

        if (response.data && response.data.status === 'success') {
          const paymentData = response.data.data;
          const currentStatus = paymentData.status;

          if (currentStatus === 'completed' && transaction.status !== 'completed') {
            // Payment is completed, update balance
            const depositResult = await userService.deposit(
              transaction.user_id, 
              transaction.amount
            );
            
            transaction.status = 'completed';
            transaction.balance_added = true;
            transaction.new_balance = depositResult.new_balance;
            transaction.completed_at = paymentData.completed_at || new Date().toISOString();
            global.snippeTransactions.set(transactionId, transaction);
            
          } else if (currentStatus === 'failed' || currentStatus === 'expired') {
            transaction.status = currentStatus;
            transaction.updated_at = new Date().toISOString();
            global.snippeTransactions.set(transactionId, transaction);
          } else {
            // Still pending, update any changes
            transaction.status = currentStatus;
            transaction.updated_at = new Date().toISOString();
            global.snippeTransactions.set(transactionId, transaction);
          }
        }
      } catch (apiError) {
        console.error('Error checking Snippe status:', apiError.message);
        // Continue with local status
      }
    }

    res.status(200).json({
      success: true,
      data: {
        transaction_id: transactionId,
        amount: transaction.amount,
        phone: transaction.phone,
        status: transaction.status,
        snippe_reference: transaction.snippe_reference,
        created_at: transaction.created_at,
        updated_at: transaction.updated_at,
        completed_at: transaction.completed_at || null,
        new_balance: transaction.new_balance || null,
        fees: transaction.fees || null,
        channel: transaction.channel || null
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

// ============ ADMIN WITHDRAW (via Snippe Disbursement) ============

/**
 * POST /api/admin/withdraw - Admin initiated withdrawal via Snippe
 * This sends money from your Snippe account to a customer's mobile money
 */
const adminWithdrawViaSnippe = async (req, res) => {
  try {
    const userId = req.user.id;
    const { amount, phone_number, transaction_id } = req.body;

    // Check admin permissions
    const user = await userRepository.findById(userId);
    if (!user || user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Admin access required'
      });
    }

    // Validate amount
    if (!amount || amount < 1000) {
      return res.status(400).json({
        success: false,
        message: 'Minimum withdrawal is 1000 TZS'
      });
    }

    if (!phone_number) {
      return res.status(400).json({
        success: false,
        message: 'Phone number is required'
      });
    }

    // Format phone for Snippe
    const snippePhone = formatPhoneForSnippe(phone_number);
    const withdrawalId = transaction_id || generateTransactionId();

    // Build Snippe disbursement request
    const requestData = {
      amount: Number(amount),
      currency: "TZS",
      phone_number: snippePhone,
      customer: {
        name: user.first_name + ' ' + user.last_name || 'Customer',
        email: user.email || 'admin@example.com'
      },
      webhook_url: `${process.env.BASE_URL || 'https://sunbeting.com'}/api/snippe-webhook`,
      reference: withdrawalId,
      metadata: {
        admin_id: userId,
        withdrawal_type: 'admin_withdrawal'
      }
    };

    console.log('📤 Snippe Disbursement Request:', JSON.stringify(requestData, null, 2));

    // Call Snippe Disbursement API
    const response = await axios.post(
      `${SNIPPE.baseUrl}/disbursements`, // Assuming endpoint from docs
      requestData,
      {
        headers: {
          'Authorization': `Bearer ${SNIPPE.apiKey}`,
          'Content-Type': 'application/json',
          'Accept': 'application/json',
          'Idempotency-Key': `WITHDRAW-${withdrawalId}`.substring(0, 30)
        },
        timeout: 30000
      }
    );

    const result = response.data;
    console.log('✅ Snippe Disbursement Response:', JSON.stringify(result, null, 2));

    // Store withdrawal transaction (optional)
    if (result.status === 'success') {
      // Update user balance (deduct amount)
      const withdrawResult = await userService.withdraw(userId, amount);
      
      return res.status(200).json({
        success: true,
        message: `Withdrawal of TZS ${amount.toLocaleString()} initiated successfully`,
        data: {
          transaction_id: withdrawalId,
          amount: amount,
          phone: snippePhone,
          status: 'pending',
          previous_balance: withdrawResult.previous_balance,
          new_balance: withdrawResult.new_balance
        }
      });
    } else {
      throw new Error(result.message || 'Failed to initiate withdrawal');
    }

  } catch (error) {
    console.error('❌ Admin withdrawal error:', error);

    let errorMessage = 'Failed to initiate withdrawal';
    
    if (error.response?.data) {
      console.error('Snippe Error:', JSON.stringify(error.response.data, null, 2));
      errorMessage = error.response.data.message || 
                    error.response.data.error_code || 
                    errorMessage;
    } else if (error.message === 'Insufficient balance') {
      errorMessage = 'Insufficient balance in your account';
    } else if (error.message) {
      errorMessage = error.message;
    }

    res.status(500).json({
      success: false,
      message: errorMessage
    });
  }
};

// ============ EXPORT ============
module.exports = {
  // Snippe deposit
  depositViaSnippe,
  snippeWebhook,
  checkSnippeStatus,
  
  // Admin withdrawal via Snippe
  adminWithdrawViaSnippe,
  
  // Keep these from original
  depositMoney,
  withdrawMoney,
  checkBalance
};