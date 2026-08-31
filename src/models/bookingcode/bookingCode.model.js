// models/bookingcode/bookingCode.model.js
// Booking Code — codes created from a bet slip that can be shared publicly.
// `selections` ni snapshot ya kila mechi iliyochaguliwa, yenye taarifa za mechi
// (home_team, away_team, league) na chaguo (market_key, outcome_key, odds).
// Uhalali wake unafungwa na muda wa kwisha (expires_at) halisi wa mechi zake.

const { DataTypes } = require('sequelize');
const sequelize = require('../../config/database');

const BookingCode = sequelize.define('BookingCode', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true,
    allowNull: false,
  },
  code: {
    type: DataTypes.STRING(10),
    allowNull: false,
    unique: true,
  },
  // Hifadhi ya hiari ya mtengeneza (si lazima — kuunda ni PUBLIC, bila login)
  creator_id: {
    type: DataTypes.UUID,
    allowNull: true,
  },
  // Snapshot ya chaguo: [{ match_id, home_team, away_team, league, market_key, outcome_key, odds }]
  selections: {
    type: DataTypes.JSON,
    allowNull: false,
    defaultValue: [],
  },
  total_odds: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: false,
    defaultValue: 1.00,
  },
  is_active: {
    type: DataTypes.BOOLEAN,
    allowNull: false,
    defaultValue: true,
  },
  // Wakati halisi wa kwanza kati ya mechi zake; baada ya wakati huu code haiwezi kutumika
  expires_at: {
    type: DataTypes.DATE,
    allowNull: false,
  },
}, {
  tableName: 'booking_codes',
  timestamps: true,
  indexes: [
    { unique: true, fields: ['code'] },
    { fields: ['creator_id'] },
    { fields: ['is_active'] },
    { fields: ['expires_at'] }
  ]
});

module.exports = BookingCode;
