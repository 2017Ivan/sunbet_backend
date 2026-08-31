// models/index.js

const sequelize = require('../config/database');
const User = require('./user/user.model');


const Match = require('./match/match.model');
const Bet = require('./bet/bet.model');
const BetSelection = require('./betSelection/betSelection.model');
const BookingCode = require('./bookingcode/bookingCode.model');
const Transaction = require('./transaction/transaction.model');

// User <-> Bet (One-to-Many)
User.hasMany(Bet, { foreignKey: 'user_id', as: 'bets' });
Bet.belongsTo(User, { foreignKey: 'user_id', as: 'user' });

// User <-> Transaction (One-to-Many)
User.hasMany(Transaction, { foreignKey: 'user_id', as: 'transactions' });
Transaction.belongsTo(User, { foreignKey: 'user_id', as: 'user' });

// User <-> BookingCode (One-to-Many)
User.hasMany(BookingCode, { foreignKey: 'creator_id', as: 'booking_codes' });
BookingCode.belongsTo(User, { foreignKey: 'creator_id', as: 'creator' });

// Bet <-> BetSelection (One-to-Many)
Bet.hasMany(BetSelection, { foreignKey: 'bet_id', as: 'selections' });
BetSelection.belongsTo(Bet, { foreignKey: 'bet_id', as: 'bet' });

// Match <-> BetSelection (One-to-Many)
Match.hasMany(BetSelection, { foreignKey: 'match_id', as: 'bet_selections' });
BetSelection.belongsTo(Match, { foreignKey: 'match_id', as: 'match' });

// Collect all models
const models = { 
  User, 
  Match,
  Bet,
  BetSelection,
  BookingCode,
  Transaction

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
  Transaction

};