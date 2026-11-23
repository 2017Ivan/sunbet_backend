// models/match/match.model.js 

const { DataTypes } = require('sequelize');
const sequelize = require('../../config/database');

const Match = sequelize.define('Match', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true,
    allowNull: false,
  },
  match_code: {
    type: DataTypes.STRING(50),
    allowNull: false,
    unique: true,
  },
  source: {
    type: DataTypes.STRING(20),
    allowNull: false,
    defaultValue: 'ADMIN',
  },
  external_id: {
    type: DataTypes.STRING(80),
    allowNull: true,
    unique: true,
  },
  home_team: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  away_team: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  league: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  date: {
    type: DataTypes.DATEONLY,
    allowNull: false,
  },
  time: {
    type: DataTypes.STRING(20),
    allowNull: false,
  },
  status: {
    type: DataTypes.ENUM('UPCOMING', 'LIVE', 'FINISHED', 'CANCELLED', 'UNKNOWN'),
    allowNull: false,
    defaultValue: 'UPCOMING',
  },
  odds: {
    type: DataTypes.JSON,
    allowNull: false,
  },
  markets: {
    type: DataTypes.JSON,
    allowNull: true,
  },
  predetermined_script: {
    type: DataTypes.JSON,
    allowNull: true,
  },
  current_score: {
    type: DataTypes.JSON,
    allowNull: true,
    defaultValue: { home: 0, away: 0 }
  },
  // Live clock inayotoka kwenye provider (status_code): dakika kama "46",
  // "45+2", au null. live_status ni "1H" | "HT" | "2H" | "FT".
  live_minute: {
    type: DataTypes.STRING(10),
    allowNull: true
  },
  live_status: {
    type: DataTypes.STRING(10),
    allowNull: true
  }
}, {
  tableName: 'matches',
  timestamps: true,
  indexes: [
    { unique: true, fields: ['match_code'] },
    { unique: true, fields: ['external_id'] },
    { fields: ['source', 'status'] },
    { fields: ['status'] },
    { fields: ['date'] }
  ]
});

module.exports = Match;