// models/index.js

const sequelize = require('../config/database');
const User = require('./user/user.model');


const Match = require('./match/match.model');
const Bet = require('./bet/bet.model');
const BetSelection = require('./betSelection/betSelection.model');
const BookingCode = require('./bookingcode/bookingCode.model');
const Transaction = require('./transaction/transaction.model');
const Notification = require('./notification/notification.model');
const DepositRequest = require('./deposit/depositRequest.model');
const DepositRecipient = require('./deposit/depositRecipient.model');
const WithdrawRequest = require('./withdraw/withdrawRequest.model');
const UserDevice = require('./userDevice/userDevice.model');

// User <-> Bet (One-to-Many)
User.hasMany(Bet, { foreignKey: 'user_id', as: 'bets' });
Bet.belongsTo(User, { foreignKey: 'user_id', as: 'user' });


// Bet <-> BetSelection (One-to-Many)
Bet.hasMany(BetSelection, { foreignKey: 'bet_id', as: 'selections' });
BetSelection.belongsTo(Bet, { foreignKey: 'bet_id', as: 'bet' });

// Match <-> BetSelection (One-to-Many)
Match.hasMany(BetSelection, { foreignKey: 'match_id', as: 'bet_selections' });
BetSelection.belongsTo(Match, { foreignKey: 'match_id', as: 'match' });

// User <-> Transaction (One-to-Many)
User.hasMany(Transaction, { foreignKey: 'user_id', as: 'transactions' });
Transaction.belongsTo(User, { foreignKey: 'user_id', as: 'user' });

// User <-> BookingCode (One-to-Many) - creator_id ni hiari
User.hasMany(BookingCode, { foreignKey: 'creator_id', as: 'booking_codes' });
BookingCode.belongsTo(User, { foreignKey: 'creator_id', as: 'creator' });

// User <-> Notification (One-to-Many)
User.hasMany(Notification, { foreignKey: 'user_id', as: 'notifications' });
Notification.belongsTo(User, { foreignKey: 'user_id', as: 'user' });

// User <-> UserDevice (One-to-Many) — FCM push tokens
User.hasMany(UserDevice, { foreignKey: 'user_id', as: 'devices' });
UserDevice.belongsTo(User, { foreignKey: 'user_id', as: 'user' });

// User <-> DepositRequest (One-to-Many)
User.hasMany(DepositRequest, { foreignKey: 'user_id', as: 'deposit_requests' });
DepositRequest.belongsTo(User, { foreignKey: 'user_id', as: 'user' });

// User <-> WithdrawRequest (One-to-Many)
User.hasMany(WithdrawRequest, { foreignKey: 'user_id', as: 'withdraw_requests' });
WithdrawRequest.belongsTo(User, { foreignKey: 'user_id', as: 'user' });

// Collect all models
const models = { 
  User, 
  Match,
  Bet,
  BetSelection,
  BookingCode,
  Transaction,
  Notification,
  DepositRequest,
  DepositRecipient,
  WithdrawRequest,
  UserDevice

};

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
      // force: true 
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
  Match,
  Bet,
  BetSelection,
  BookingCode,
  Transaction,
  Notification,
  DepositRequest,
  DepositRecipient,
  WithdrawRequest,
  UserDevice

};