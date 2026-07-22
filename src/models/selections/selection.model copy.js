// models/selections/selection.model.js
const { DataTypes } = require('sequelize');
const sequelize = require('../../config/database');
const { v4: uuidv4 } = require('uuid');

const Selection = sequelize.define('Selection', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true,
    allowNull: false
  },

  bookingCodeId: {
    type: DataTypes.UUID,
    allowNull: false,
    references: {
      model: 'booking_codes',
      key: 'id'
    }
  },

  // Match/game details
  matchId: {
    type: DataTypes.STRING(50),
    allowNull: false,
    comment: 'ID of the match/game'
  },

  matchName: {
    type: DataTypes.STRING(255),
    allowNull: false,
    comment: 'Name of the match (e.g., "Team A vs Team B")'
  },

  // Selection details
  selectionType: {
    type: DataTypes.ENUM('HOME', 'DRAW', 'AWAY', 'OVER', 'UNDER', 'YES', 'NO'),
    allowNull: false,
    comment: 'Type of selection (1X2, over/under, etc)'
  },

  selectionValue: {
    type: DataTypes.STRING(50),
    allowNull: false,
    comment: 'Value selected (e.g., "Team A", "Over 2.5")'
  },

  odds: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: false,
    validate: {
      min: 0
    }
  },

  // Score field - to be updated later
  score: {
    type: DataTypes.JSON,
    allowNull: true,
    comment: 'Stores match scores as JSON: { home: 2, away: 1 }'
  },

  // Result of this specific selection
  result: {
    type: DataTypes.ENUM('PENDING', 'WON', 'LOST'),
    defaultValue: 'PENDING',
    comment: 'Result of this selection'
  },

  // Whether this selection was settled
  isSettled: {
    type: DataTypes.BOOLEAN,
    defaultValue: false
  },

  settledAt: {
    type: DataTypes.DATE,
    allowNull: true
  }

}, {
  tableName: 'selections',
  timestamps: true
});

Selection.associate = (models) => {
  Selection.belongsTo(models.BookingCode, {
    foreignKey: 'bookingCodeId',
    as: 'bookingCode',
    targetKey: 'id'
  });

  Selection.hasMany(models.Bet, {
    foreignKey: 'selectionId',
    as: 'bets',
    targetKey: 'id'
  });
};

module.exports = Selection;