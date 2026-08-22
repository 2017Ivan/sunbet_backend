// controllers/financial/money.controller.js
const userService = require('../../services/auth.service');
const userRepository = require('../../repositories/user.repository');
const axios = require('axios');
const crypto = require('crypto');

// ============ SNIPPE CONFIGURATION ============
const SNIPPE = {
  apiKey: 'snp_b0c2ed1711e20a8951538a7814fb9eb15e59a73c0c0b45cfdc0f0ca4eecef498',
  baseUrl: 'https://api.snippe.sh/v1',
};

// Store pending transactions
if (!global.snippeTransactions) {
  global.snippeTransactions = new Map();
}

// ============ HELPERS ============
function generateTransactionId() {
  return `TXN${Date.now()}${crypto.randomBytes(4).toString('hex').toUpperCase()}`;
}

function formatPhoneForSnippe(phone) {
  let cleaned = phone.replace(/\D/g, '');
  if (cleaned.startsWith('0')) {
    cleaned = '255' + cleaned.substring(1);
  }
  if (cleaned.startsWith('255') && cleaned.length === 12) {
    return cleaned;
  }
  return cleaned;
}

// =============================================
// ============ DEPOSIT (Snippe Mobile Money) ============
// =============================================

/**
 * POST /api/deposit - Initiate Snippe mobile money deposit
 */
const deposit = async (req, res) => {
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

    const snippePhone = formatPhoneForSnippe(phone_number);
    const transactionId = generateTransactionId();

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

    const response = await axios.post(
      `${SNIPPE.baseUrl}/payments`,
      requestData,
      {
        headers: {
          'Authorization': `Bearer ${SNIPPE.apiKey}`,
          'Content-Type': 'application/json',
          'Accept': 'application/json',
          'Idempotency-Key': transactionId.substring(0, 30)
        },
        timeout: 30000
      }
    );

    const result = response.data;
    console.log('✅ Snippe Response:', JSON.stringify(result, null, 2));

    if (result.status === 'success' && result.data) {
      const paymentData = result.data;
      
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

// =============================================
// ============ WITHDRAW ============
// =============================================

const withdraw = async (req, res) => {
  try {
    const userId = req.user.id;
    const { amount } = req.body;

    if (!amount || amount < 1000) {
      return res.status(400).json({
        success: false,
        message: 'Minimum withdrawal is 1000 TZS'
      });
    }

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

// =============================================
// ============ BALANCE ============
// =============================================

const balance = async (req, res) => {
  try {
    const userId = req.user.id;
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

// =============================================
// ============ SNIPPE WEBHOOK ============
// =============================================

const snippeWebhook = async (req, res) => {
  console.log('🔥 Snippe Webhook received:', JSON.stringify(req.body, null, 2));

  try {
    const webhookData = req.body;
    const eventType = webhookData.type || webhookData.event;
    const eventData = webhookData.data || webhookData;

    if (eventType === 'payment.completed' || 
        (eventData.status && eventData.status === 'completed')) {
      
      const snippeReference = eventData.reference;
      
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

      if (foundTransaction.status === 'completed') {
        console.log(`Transaction ${foundKey} already processed`);
        return res.status(200).json({ message: 'Already processed' });
      }

      let amount = foundTransaction.amount;
      if (eventData.amount && eventData.amount.value) {
        amount = eventData.amount.value;
      }
      
      const depositResult = await userService.deposit(foundTransaction.user_id, amount);

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

    } else if (eventType === 'payment.failed' || 
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
    res.status(200).json({
      message: 'Webhook received with errors',
      status: 'error'
    });
  }
};

// =============================================
// ============ CHECK PAYMENT STATUS ============
// =============================================

const checkPaymentStatus = async (req, res) => {
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

    if (transaction.user_id !== userId) {
      return res.status(403).json({
        success: false,
        message: 'Unauthorized'
      });
    }

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
            transaction.status = currentStatus;
            transaction.updated_at = new Date().toISOString();
            global.snippeTransactions.set(transactionId, transaction);
          }
        }
      } catch (apiError) {
        console.error('Error checking Snippe status:', apiError.message);
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

// =============================================
// ============ ADMIN WITHDRAW ============
// =============================================

const adminWithdraw = async (req, res) => {
  try {
    const userId = req.user.id;
    const { amount, phone_number, transaction_id } = req.body;

    const user = await userRepository.findById(userId);
    if (!user || user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Admin access required'
      });
    }

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

    const snippePhone = formatPhoneForSnippe(phone_number);
    const withdrawalId = transaction_id || generateTransactionId();

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

    const response = await axios.post(
      `${SNIPPE.baseUrl}/disbursements`,
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

    if (result.status === 'success') {
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

// =============================================
// ============ EXPORT ============
// =============================================

module.exports = {
  // Deposit (Snippe)
  deposit,
  
  // Withdraw & Balance
  withdraw,
  balance,
  
  // Snippe Webhook
  snippeWebhook,
  
  // Check payment status
  checkPaymentStatus,
  
  // Admin withdrawal via Snippe
  adminWithdraw
};