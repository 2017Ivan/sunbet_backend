const { verifyAccessToken } = require('../utils/jwt');
const { body, param, query, validationResult } = require('express-validator');

// ============================================
// 1. AUTHENTICATION - Verify Token Only
// ============================================
const authenticate = (req, res, next) => {
  console.log('🔍 ===== AUTH MIDDLEWARE =====');
  console.log('📌 Path:', req.path);
  console.log('📌 Method:', req.method);

  const authHeader = req.headers.authorization;

  if (!authHeader) {
    console.log('❌ No authorization header');
    return res.status(401).json({ 
      success: false, 
      message: 'Access token required' 
    });
  }

  if (!authHeader.startsWith('Bearer ')) {
    console.log('❌ Invalid format');
    return res.status(401).json({ 
      success: false, 
      message: 'Invalid authorization format' 
    });
  }

  const token = authHeader.split(' ')[1];

  try {
    const decoded = verifyAccessToken(token);
    console.log('✅ Token verified for user:', decoded.id);

    req.user = {
      id: decoded.id,
      email: decoded.email,
      role: decoded.role,
      ...decoded
    };

    console.log('👤 User role:', req.user.role);
    console.log('🔍 ===== AUTH COMPLETED =====\n');
    next();
  } catch (error) {
    console.log('❌ Token invalid:', error.message);
    return res.status(401).json({ 
      success: false, 
      message: 'Invalid or expired token' 
    });
  }
};

// ============================================
// 2. AUTHORIZATION - Check Role Dynamically
// ============================================
const authorize = (allowedRoles) => {
  return (req, res, next) => {
    console.log('🔐 ===== AUTHORIZATION =====');
    console.log('🎭 Required roles:', allowedRoles);
    console.log('👤 User role:', req.user?.role);

    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required'
      });
    }

    const roles = Array.isArray(allowedRoles) ? allowedRoles : [allowedRoles];

    if (!roles.includes(req.user.role)) {
      console.log('❌ Access denied for role:', req.user.role);
      return res.status(403).json({
        success: false,
        message: `Access denied. Required roles: ${roles.join(', ')}`
      });
    }

    console.log('✅ Access granted');
    console.log('🔐 ===== AUTHORIZATION COMPLETED =====\n');
    next();
  };
};

// ============================================
// 3. VALIDATION HELPER
// ============================================
const validate = (validations) => {
  return async (req, res, next) => {
    await Promise.all(validations.map(validation => validation.run(req)));

    const errors = validationResult(req);
    if (errors.isEmpty()) {
      return next();
    }

    return res.status(400).json({
      success: false,
      errors: errors.array().map(err => ({
        field: err.path,
        message: err.msg
      }))
    });
  };
};

// ============================================
// 4. EXPORTS
// ============================================
module.exports = {
  authenticate,
  authorize,
  validate
};