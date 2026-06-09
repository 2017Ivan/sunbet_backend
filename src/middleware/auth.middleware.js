const { verifyAccessToken } = require('../utils/jwt');
const { body, param, validationResult } = require('express-validator');

const authenticate = (req, res, next) => {
  console.log('🔍 ===== AUTH MIDDLEWARE TRIGGERED =====');
  console.log('📌 Path:', req.path);
  console.log('📌 Method:', req.method);

  const authHeader = req.headers.authorization;
  console.log('📨 Auth header present:', !!authHeader);

  if (!authHeader) {
    console.log('❌ No authorization header found');
    return res.status(401).json({ message: 'Access token required' });
  }

  console.log('📨 Auth header format:', authHeader.substring(0, 20) + '...');
  if (!authHeader.startsWith('Bearer ')) {
    console.log('❌ Auth header does not start with Bearer');
    return res.status(401).json({ message: 'Invalid authorization format' });
  }

  const token = authHeader.split(' ')[1];
  console.log('🔑 Token length:', token?.length || 0);
  console.log('🔑 Token preview:', token?.substring(0, 20) + '...');

  try {
    const decoded = verifyAccessToken(token);
    console.log('✅ Token verified successfully');
    console.log('👤 Decoded user:', decoded);
    
    req.user = decoded;
    console.log('✅ User attached to request:', req.user.id);
    console.log('🔍 ===== AUTH MIDDLEWARE COMPLETED =====\n');
    
    next();
  } catch (error) {
    console.log('❌ Token verification failed:', error.message);
    console.log('🔍 ===== AUTH MIDDLEWARE FAILED =====\n');
    return res.status(401).json({ message: 'Invalid or expired token' });
  }
};

const validateBetPlacement = [
  body('selections')
    .isArray({ min: 1 })
    .withMessage('At least one selection is required'),
  body('selections.*.match')
    .notEmpty()
    .withMessage('Match is required'),
  body('selections.*.selection')
    .isIn(['1', 'X', '2'])
    .withMessage('Selection must be 1, X, or 2'),
  body('selections.*.odds')
    .isFloat({ min: 1.01 })
    .withMessage('Odds must be greater than 1'),
  body('stake')
    .isFloat({ min: 100 })
    .withMessage('Stake must be at least 100'),
  (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ 
        success: false, 
        errors: errors.array() 
      });
    }
    next();
  }
];

const validateSettleBet = [
  param('betId')
    .isInt()
    .withMessage('Invalid bet ID'),
  body('result')
    .isIn(['WON', 'LOST'])
    .withMessage('Result must be WON or LOST'),
  (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ 
        success: false, 
        errors: errors.array() 
      });
    }
    next();
  }
];

module.exports = {
  validateBetPlacement,
  validateSettleBet,
  authenticate
};
