// controllers/financial/money.controller.js
const userService = require('../../services/auth.service');

// ============ DEPOSIT ============

/**
 * POST /api/deposit - Deposit money
 */
const depositMoney = async (req, res) => {
  try {
    const userId = req.user.id;
    const { amount } = req.body;

    // Validate amount
    if (!amount || amount < 500) {
      return res.status(400).json({
        success: false,
        message: 'Amount must be at least 500 TZS'
      });
    }

    // Call userService deposit
    const result = await userService.deposit(userId, amount);

    res.status(200).json({
      success: true,
      message: `TZS ${amount.toLocaleString()} deposited successfully. Balance: TZS ${result.new_balance.toLocaleString()}`,
      data: {
        amount: result.deposited_amount,
        previous_balance: result.previous_balance,
        new_balance: result.new_balance
      }
    });

  } catch (error) {
    console.error('Deposit error:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Deposit failed'
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

    // Validate amount
    if (!amount || amount < 1000) {
      return res.status(400).json({
        success: false,
        message: 'Minimum withdrawal is 1000 TZS'
      });
    }

    // Call userService withdraw
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
    
    // Handle specific errors
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

// ============ BALANCE ============

/**
 * GET /api/balance - Check balance
 */
const checkBalance = async (req, res) => {
  try {
    const userId = req.user.id;

    // Call userService getBalance
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

// ============ EXPORT ============
module.exports = {
  depositMoney,
  withdrawMoney,
  checkBalance
};