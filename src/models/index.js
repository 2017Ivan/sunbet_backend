const sequelize = require('../config/database');
const User = require('./user.model');
const Bet = require('./bet.model');
const PasswordReset = require('./password-reset.model');
const BookingCode = require('./bookingCode.model');
const Notification = require('./notification.model');
const DepositTransaction = require('./depositTransaction.model');
// Collect all models
const models = { User, Bet,PasswordReset ,BookingCode,Notification,DepositTransaction};

// Initialize associations - Run associate methods if they exist
Object.keys(models).forEach(modelName => {
  if (models[modelName].associate) {
    models[modelName].associate(models);
  }
});

const initModels = async () => {
  try {
    await sequelize.sync({
      alter: true 
    });
  

    console.log('Database models synchronized successfully');
  } catch (error) {
    console.error('Error synchronizing models:', error.message);
    throw error;
  }
};

module.exports = {
  sequelize,
  initModels,
  User,
  Bet,
  PasswordReset,
  BookingCode
};