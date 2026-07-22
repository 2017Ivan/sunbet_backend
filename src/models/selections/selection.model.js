// models/selections/selection.model.js

const { DataTypes } = require('sequelize');
const sequelize = require('../../config/database');

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

  // Selections zote kama JSON array katika row moja
  selections: {
    type: DataTypes.JSON,
    allowNull: false,
    defaultValue: [],
    comment: 'Array of selections: [{ matchId, matchName, selectionType, selectionValue, odds, score, result }]'
  }

}, {
  tableName: 'selections',
  timestamps: true
});

Selection.associate = (models) => {
  Selection.belongsTo(models.BookingCode, {
    foreignKey: 'bookingCodeId',
    as: 'bookingCode',  // ← Alias ni 'bookingCode'
    targetKey: 'id'
  });

  Selection.hasMany(models.Bet, {
    foreignKey: 'selectionId',
    as: 'bets',
    targetKey: 'id'
  });
};

module.exports = Selection;