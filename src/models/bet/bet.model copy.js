const { DataTypes } = require('sequelize');
const sequelize = require('../../config/database');

const Bet = sequelize.define('Bet', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true,
    allowNull: false,
  },
  ticket_code: {
    type: DataTypes.STRING(20),
    allowNull: false,
    unique: true,
  },
  user_id: {
    type: DataTypes.UUID,
    allowNull: false,
  },
  stake: {
    type: DataTypes.DECIMAL(12, 2),
    allowNull: false,
    validate: {
      min: 1.00
    }
  },
  total_odds: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: false,
  },
  possible_win: {
    type: DataTypes.DECIMAL(12, 2),
    allowNull: false,
  },
  status: {
    type: DataTypes.ENUM('PENDING', 'WON', 'LOST', 'CANCELLED'),
    allowNull: false,
    defaultValue: 'PENDING',
  },
  placed_via: {
    type: DataTypes.ENUM('DIRECT', 'BOOKING_CODE'),
    allowNull: false,
    defaultValue: 'DIRECT',
  },
  booking_code_used: {
    type: DataTypes.STRING(10),
    allowNull: true,
  }
}, {
  tableName: 'bets',
  timestamps: true,
  indexes: [
    { unique: true, fields: ['ticket_code'] },
    { fields: ['user_id'] },
    { fields: ['status'] }
  ]
});

module.exports = Bet;