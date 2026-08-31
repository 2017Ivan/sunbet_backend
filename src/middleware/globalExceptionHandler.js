// globalExceptionHandler.js
const responseBuilder = require('../utils/response.builder');
const CustomExceptions = require('./CustomExceptions');

const GlobalExceptionsHandler = (err, req, res, next) => {
  console.error('Global Error:', err);

  if (err instanceof CustomExceptions) {
    // ✅ SAHIHI - Tumia OBJECT
    const response = responseBuilder.error({
      status: err.status || 400,
      message: err.message,
      error_message: err.error_message || null
    });
    return res.status(response.status).json(response);
  }

  // ✅ SAHIHI - Tumia OBJECT
  const response = responseBuilder.error({
    status: 500,
    message: err.message || 'Internal Server Error',
    error_message: err.error_message || null
  });
  return res.status(response.status).json(response);
};

module.exports = GlobalExceptionsHandler;