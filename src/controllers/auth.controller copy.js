const userService = require('../services/auth.service');

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



const depositMoney = async (req, res) => {
  try {
    const userId = req.user.id; // From auth middleware
    const { amount } = req.body;

    if (!amount) {
      return res.status(400).json({ 
        message: 'Amount is required' 
      });
    }

    const result = await userService.deposit(userId, amount);

    res.status(200).json({
      message: 'Deposit successful',
      data: result
    });

  } catch (error) {
    res.status(400).json({ 
      message: error.message 
    });
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
  getProfile
};