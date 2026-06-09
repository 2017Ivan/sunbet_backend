// utils/errors.js
/**
 * Base AppError class
 */
class AppError extends Error {
  constructor(message, statusCode) {
    super(message);
    this.statusCode = statusCode;
    this.isOperational = true;
    this.name = this.constructor.name;
    Error.captureStackTrace(this, this.constructor);
  }
}

/**
 * Specific error classes extending AppError
 */
class ValidationError extends AppError {
  constructor(message) {
    super(message, 400);
  }
}

class AuthenticationError extends AppError {
  constructor(message) {
    super(message, 401);
  }
}

class NotFoundError extends AppError {
  constructor(message) {
    super(message, 404);
  }
}

class ConflictError extends AppError {
  constructor(message) {
    super(message, 409);
  }
}

class InsufficientBalanceError extends AppError {
  constructor(message) {
    super(message, 400);
  }
}

/**
 * Error handler middleware
 */
const errorHandler = (err, req, res, next) => {
  console.error('Error:', {
    name: err.name,
    message: err.message,
    stack: err.stack,
    statusCode: err.statusCode
  });

  // Handle known operational errors
  if (err.isOperational) {
    return res.status(err.statusCode).json({
      success: false,
      message: err.message,
      error: err.name
    });
  }

  // Handle Sequelize errors
  if (err.name === 'SequelizeValidationError' || err.name === 'SequelizeUniqueConstraintError') {
    return res.status(400).json({
      success: false,
      message: err.errors?.[0]?.message || 'Database validation error',
      error: 'DatabaseError'
    });
  }

  if (err.name === 'SequelizeForeignKeyConstraintError') {
    return res.status(400).json({
      success: false,
      message: 'Referenced record does not exist',
      error: 'ForeignKeyError'
    });
  }

  // Handle JWT errors
  if (err.name === 'JsonWebTokenError') {
    return res.status(401).json({
      success: false,
      message: 'Invalid token',
      error: 'JsonWebTokenError'
    });
  }

  if (err.name === 'TokenExpiredError') {
    return res.status(401).json({
      success: false,
      message: 'Token expired',
      error: 'TokenExpiredError'
    });
  }

  // Unknown error
  console.error('Unhandled error:', err);
  return res.status(500).json({
    success: false,
    message: 'Internal server error',
    error: 'InternalServerError'
  });
};

/**
 * Async handler wrapper to avoid try-catch in controllers
 */
const asyncHandler = (fn) => (req, res, next) => {
  Promise.resolve(fn(req, res, next)).catch(next);
};

module.exports = {
  // Error classes
  AppError,
  ValidationError,
  AuthenticationError,
  NotFoundError,
  ConflictError,
  InsufficientBalanceError,
  
  // Error handler middleware
  errorHandler,
  
  // Async handler wrapper
  asyncHandler
};