class CustomExceptions extends Error {
  constructor(message, status = 400, error_message = null) {
    super(message);
    this.status = status;
    this.error_message = error_message;
    Error.captureStackTrace(this, this.constructor);
  }
}

module.exports = CustomExceptions;
