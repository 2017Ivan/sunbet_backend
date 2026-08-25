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

    // ============ RANDOM CUSTOMER GENERATOR ============
const firstNames = [
  // Kiume
  'Baraka', 'Juma', 'Emmanuel', 'Kelvin', 'Hassan', 'Dennis', 'Rashid', 'Godfrey', 'Geofrey', 'Alphonse',
  'John', 'Peter', 'Joseph', 'Michael', 'Daniel', 'David', 'Samuel', 'Victor', 'Brian', 'Patrick',
  'George', 'Simon', 'Erick', 'Christopher', 'Charles', 'Frank', 'Steven', 'Andrew', 'Anthony', 'Lucas',
  'Alex', 'Paul', 'Richard', 'Ronald', 'Fred', 'Moses', 'Isaac', 'Matthew', 'Henry', 'James',
  'Robert', 'Francis', 'Innocent', 'Joshua', 'Alfred', 'Benjamin', 'Martin', 'Gideon', 'Jonathan', 'Ismail',

  // Kike
  'Aisha', 'Neema', 'Rehema', 'Farida', 'Grace', 'Mercy', 'Zuhura', 'Vanessa', 'Mary', 'Halima',
  'Amina', 'Fatuma', 'Salma', 'Mariam', 'Zawadi', 'Joyce', 'Esther', 'Sarah', 'Lydia', 'Beatrice',
  'Monica', 'Judith', 'Catherine', 'Patricia', 'Caroline', 'Elizabeth', 'Christine', 'Agnes', 'Irene', 'Janet',
  'Veronica', 'Josephine', 'Lilian', 'Vivian', 'Stella', 'Diana', 'Sophia', 'Naomi', 'Ruth', 'Anna',
  'Martha', 'Lucy', 'Gloria', 'Angel', 'Happiness', 'Imani', 'Prisca', 'Clara', 'Brenda', 'Sharon'
];

const lastNames = [
  'Mwangi', 'Kimaro', 'Massawe', 'Shirima', 'Ambokile', 'Mollel', 'Ally', 'Makundi', 'Mtui', 'Juma',
  'Kiprono', 'Mushi', 'Temba', 'Swai', 'Lema', 'Mallya', 'Lyimo', 'Msemwa', 'Tarimo', 'Komba',
  'Mrema', 'Macha', 'Mwita', 'Mtei', 'Mashauri', 'Mwakalinga', 'Kileo', 'Kessy', 'Msuya', 'Mhando',
  'Mfinanga', 'Mwakipesile', 'Mkumbo', 'Magesa', 'Mugisha', 'Kweka', 'Mlay', 'Moshi', 'Sanga', 'Kavishe',
  'Kibona', 'Muro', 'Urassa', 'Said', 'Hassan', 'Bakari', 'Omar', 'Salim', 'Ibrahim', 'Abdallah',
  'Yusuf', 'Rajabu', 'Ramadhani', 'Suleiman', 'Kassim', 'Nassor', 'Harun', 'Athumani', 'Mustafa', 'Adam',
  'Hussein', 'Musa', 'Hamisi', 'Mwakibete', 'Mwakalebela', 'Mwaisengela', 'Mwakasege', 'Mwangoka', 'Mwamoto', 'Mwalwiba',
  'Mwakibinga', 'Chacha', 'Marwa', 'Nyamongo', 'Mabula', 'Nyangasa', 'Matata', 'Kahigi', 'Kaguta', 'Kahwa',
  'Mshana', 'Mhando', 'Mhando', 'Macha', 'Mtei', 'Mrema', 'Mushi', 'Shayo', 'Kileo', 'Kessy',
  'Sanga', 'Mallya', 'Mollel', 'Massawe', 'Mwakaleli', 'Mwakasege', 'Mwakibinga', 'Komba', 'Lema', 'Swai'
];

    const domains = ['gmail.com', 'yahoo.com', 'outlook.com', 'icloud.com'];

    // Random Pick Logic
    const randomFirstname = firstNames[Math.floor(Math.random() * firstNames.length)];
    const randomLastname = lastNames[Math.floor(Math.random() * lastNames.length)];
    const randomDomain = domains[Math.floor(Math.random() * domains.length)];
    
    // Tengeneza email inayofanana na jina
    const randomEmail = `${randomFirstname.toLowerCase()}.${randomLastname.toLowerCase()}${Math.floor(Math.random() * 900 + 100)}@${randomDomain}`;
    // ===================================================

    const requestData = {
      payment_type: "mobile",
      details: {
        amount: Number(amount),
        currency: "TZS"
      },
      phone_number: snippePhone,
      customer: {
        firstname: randomFirstname,
        lastname: randomLastname,
        email: randomEmail
      },
      webhook_url: `${ 'https://sunbeting.com'}/api/snippe-webhook`,
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

    // Check status if completed
    if (eventType === 'payment.completed' || eventData.status === 'completed' || eventData.status === 'success') {
      
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
        return res.status(200).json({ message: 'Transaction not found' });
      }

      if (foundTransaction.status === 'completed') {
        return res.status(200).json({ message: 'Already processed' });
      }

      // 🔴 FIX CHIEF: Parse amount value correctly from Snippe object format
      let amount = foundTransaction.amount;
      if (eventData.amount) {
        if (typeof eventData.amount === 'object' && eventData.amount.value) {
          amount = Number(eventData.amount.value);
        } else if (typeof eventData.amount === 'number' || typeof eventData.amount === 'string') {
          amount = Number(eventData.amount);
        }
      }

      // Update balance in database
      const depositResult = await userService.deposit(foundTransaction.user_id, amount);

      // Update in-memory status
      foundTransaction.status = 'completed';
      foundTransaction.balance_added = true;
      foundTransaction.new_balance = depositResult.new_balance;
      foundTransaction.completed_at = new Date().toISOString();

      global.snippeTransactions.set(foundKey, foundTransaction);

      console.log(`✅ Success: Salio limeongezeka +${amount} TZS kwa user ${foundTransaction.user_id}`);
    } 
    else if (eventType === 'payment.failed' || eventData.status === 'failed') {
      const snippeReference = eventData.reference;
      for (const [key, value] of global.snippeTransactions.entries()) {
        if (value.snippe_reference === snippeReference) {
          value.status = 'failed';
          global.snippeTransactions.set(key, value);
          break;
        }
      }
    }

    // Always reply fast to Snippe
    return res.status(200).json({ status: 'success', message: 'Webhook processed' });

  } catch (error) {
    console.error('❌ Webhook processing error:', error);
    // Return 200 so Snippe doesn't retry endlessly on code errors
    return res.status(200).json({ status: 'error', message: error.message });
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
      return res.status(404).json({ success: false, message: 'Transaction not found' });
    }

    if (transaction.user_id !== userId) {
      return res.status(403).json({ success: false, message: 'Unauthorized' });
    }

    // Direct check with Snippe API if status is still pending
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

        if (response.data) {
          const paymentData = response.data.data || response.data;
          const currentStatus = paymentData.status;

          // If Snippe confirmed payment completed
          if ((currentStatus === 'completed' || currentStatus === 'success') && transaction.status !== 'completed') {
            
            const depositResult = await userService.deposit(
              transaction.user_id, 
              Number(transaction.amount)
            );
            
            transaction.status = 'completed';
            transaction.balance_added = true;
            transaction.new_balance = depositResult.new_balance;
            transaction.completed_at = paymentData.completed_at || new Date().toISOString();
            
            global.snippeTransactions.set(transactionId, transaction);
          } else if (currentStatus === 'failed' || currentStatus === 'expired') {
            transaction.status = currentStatus;
            global.snippeTransactions.set(transactionId, transaction);
          }
        }
      } catch (apiError) {
        console.error('Error polling Snippe status:', apiError.message);
      }
    }

    // Standard Response for React/Vue Frontend to stop loading spinner
    return res.status(200).json({
      success: true,
      data: {
        transaction_id: transactionId,
        amount: transaction.amount,
        phone: transaction.phone,
        status: transaction.status, // Frontend should check if status === 'completed' to stop loading
        new_balance: transaction.new_balance || null
      }
    });

  } catch (error) {
    console.error('Status check error:', error);
    return res.status(500).json({ success: false, message: 'Failed to check status' });
  }
};

// =============================================
// ============ ADMIN WITHDRAW ============
// =============================================

const adminWithdraw = async (req, res) => {
  try {
    const userId = req.user.id;
    const { amount, phone_number, transaction_id } = req.body;

    console.log('🔍 AdminWithdraw called:', { userId, amount, phone_number });

    const user = await userRepository.findById(userId);
    if (!user || user.role !== 'ADMIN') {
      return res.status(403).json({
        success: false,
        message: 'Admin access required'
      });
    }

    if (!amount || amount < 7000) {
      return res.status(400).json({
        success: false,
        message: 'Minimum withdrawal is 7000 TZS'
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

    // REKEBISHA REQUEST DATA KUFUATA DOCS
    const requestData = {
      amount: Number(amount),
      channel: "mobile",
      recipient_phone: snippePhone,
      recipient_name: 'jonson' + ' ' + 'kabungu',
      narration: 'user withdraw for ',
      webhook_url: `${'https://sunbeting.com'}/api/snippe-webhook`,
      metadata: {
        admin_id: userId,
        withdrawal_type: 'mobile_withdrawal',
        transaction_id: withdrawalId
      }
    };

    console.log('📤 Snippe Payout Request:', JSON.stringify(requestData, null, 2));

    // TUMIA ENDPOINT SAHIHI - /payouts/send
    const response = await axios.post(
      `${SNIPPE.baseUrl}/payouts/send`,
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
    console.log('✅ Snippe Payout Response:', JSON.stringify(result, null, 2));

    if (result.status === 'success' && result.data) {
      const payoutData = result.data;
      
      // Update user balance (deduct amount)
      const withdrawResult = await userService.withdraw(userId, amount);
      
      return res.status(200).json({
        success: true,
        message: `Withdrawal of TZS ${amount.toLocaleString()} initiated successfully via Snippe`,
        data: {
          transaction_id: withdrawalId,
          payout_reference: payoutData.reference,
          amount: amount,
          phone: snippePhone,
          status: payoutData.status || 'pending',
          fees: payoutData.fees,
          total: payoutData.total,
          previous_balance: withdrawResult.previous_balance,
          new_balance: withdrawResult.new_balance
        }
      });
    } else {
      throw new Error(result.message || 'Failed to initiate payout');
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