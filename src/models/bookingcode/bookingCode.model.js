// models/bookingcode/bookingCode.model.js

const { DataTypes } = require('sequelize');
const sequelize = require('../../config/database');

const BookingCode = sequelize.define('BookingCode', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true,
    allowNull: false
  },

  code: {
    type: DataTypes.STRING(20),
    allowNull: false,
    unique: true
  },

  userId: {
    type: DataTypes.UUID,
    allowNull: true,
    references: {
      model: 'users',
      key: 'id'
    }
  },

  // Selections zote kama JSON array katika booking code moja kwa moja
  selections: {
    type: DataTypes.JSON,
    allowNull: false,
    defaultValue: [],
    comment: 'Array of selections: [{ matchId, matchName, selectionType, selectionValue, odds, score, result }]'
  },

  presetStake: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: true
  },

  status: {
    type: DataTypes.ENUM('ACTIVE', 'EXPIRED'),
    defaultValue: 'ACTIVE'
  },

  expiresAt: {
    type: DataTypes.DATE,
    allowNull: false
  }

}, {
  tableName: 'booking_codes',
  timestamps: true
});

BookingCode.associate = (models) => {
  BookingCode.belongsTo(models.User, {
    foreignKey: 'userId',
    as: 'creator',
    targetKey: 'id'
  });

  BookingCode.hasMany(models.Bet, {
    foreignKey: 'bookingCodeId',
    as: 'bets',
    targetKey: 'id'
  });
};

module.exports = BookingCode;