// utils/idGenerator.js
const generateRandomId = () => {
    // Generate random 11-digit number (from 10000000000 to 99999999999)
    const min = 10000000000; // 11 digits minimum
    const max = 99999999999; // 11 digits maximum
    return Math.floor(Math.random() * (max - min + 1) + min).toString();
  };
  
  // Verify ID is exactly 11 digits
  const isValidId = (id) => {
    return /^\d{11}$/.test(id);
  };
  
  module.exports = { generateRandomId, isValidId };