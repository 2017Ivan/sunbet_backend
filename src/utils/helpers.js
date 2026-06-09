// utils/helpers.js
const generateBookingCode = () => {
    const prefix = 'BET';
    const timestamp = Date.now().toString(36).toUpperCase();
    const random = Math.random().toString(36).substring(2, 8).toUpperCase();
    return `${prefix}${timestamp}${random}`;
  };
  
  module.exports = {
    generateBookingCode
  };