// models/bets/bet.model.js

const { DataTypes } = require('sequelize');
const sequelize = require('../../config/database');

const Bet = sequelize.define('Bet', {
  id: {
    type: DataTypes.STRING(11),
    primaryKey: true,
    allowNull: false,
    validate: {
      len: [11, 11],
      isNumeric: true
    }
  },

  userId: {
    type: DataTypes.UUID,
    allowNull: false,
    references: {
      model: 'users',
      key: 'id'
    }
  },

  bookingCodeId: {
    type: DataTypes.UUID,
    allowNull: false,
    references: {
      model: 'booking_codes',
      key: 'id'
    }
  },

  // selectionId imeondolewa - bet inapata selections kupitia bookingCodeId

  isWinningNotified: {
    type: DataTypes.BOOLEAN,
    defaultValue: false
  },

  stake: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: false,
    validate: {
      min: 1
    }
  },

  totalOdds: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: false
  },

  potentialReturn: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: false
  },

  status: {
    type: DataTypes.ENUM('OPEN', 'SETTLED', 'CANCELLED'),
    defaultValue: 'OPEN'
  },

  result: {
    type: DataTypes.ENUM('PENDING', 'WON', 'LOST'),
    defaultValue: 'PENDING'
  },

  settledAt: {
    type: DataTypes.DATE,
    allowNull: true
  }

}, {
  tableName: 'bets',
  timestamps: true
});

Bet.associate = (models) => {
  Bet.belongsTo(models.User, {
    foreignKey: 'userId',
    as: 'user',
    targetKey: 'id'
  });

  Bet.belongsTo(models.BookingCode, {
    foreignKey: 'bookingCodeId',
    as: 'bookingCode',
    targetKey: 'id'
  });

};

module.exports = Bet;