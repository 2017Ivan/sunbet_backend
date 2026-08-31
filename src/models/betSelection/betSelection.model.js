// models/betSelection/betSelection.model.js 
const { DataTypes } = require('sequelize');
const sequelize = require('../../config/database');

const BetSelection = sequelize.define('BetSelection', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true,
    allowNull: false,
  },
  bet_id: {
    type: DataTypes.UUID,
    allowNull: false,
  },
  match_id: {
    type: DataTypes.UUID,
    allowNull: false,
  },
  market_key: {
    type: DataTypes.STRING(50),
    allowNull: false, // Mfano: '1X2', 'Over_Under', 'Correct_Score'
  },
  outcome_key: {
    type: DataTypes.STRING(50),
    allowNull: false, // Mfano: '1', 'OVER_2.5', '2-1'
  },
  odds_at_placement: {
    type: DataTypes.DECIMAL(8, 2),
    allowNull: false,
  },
  status: {
    type: DataTypes.ENUM('PENDING', 'WON', 'LOST', 'CANCELLED'),
    allowNull: false,
    defaultValue: 'PENDING',
  }
}, {
  tableName: 'bet_selections',
  timestamps: true,
  indexes: [
    { fields: ['bet_id'] },
    { fields: ['match_id'] },
    { fields: ['status'] }
  ]
});

module.exports = BetSelection;