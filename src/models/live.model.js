// models/football.model.js
const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const LiveMatch = sequelize.define('LiveMatch', {

  id: {
    type: DataTypes.BIGINT,
    primaryKey: true
  },

  time: {
    type: DataTypes.STRING(100),
    allowNull: true
  },
  date: {
    type: DataTypes.STRING(100),
    allowNull: true
  },
  homeTeam: {
    type: DataTypes.STRING(100),
    allowNull: true
  },

  awayTeam: {
    type: DataTypes.STRING(100),
    allowNull: true
  },

  league: {
    type: DataTypes.STRING(150),
    allowNull: true
  },
  term: {
    type: DataTypes.STRING(150),
    allowNull: true
  },
  homeGoals: {
    type: DataTypes.STRING(150),
    allowNull: true
  },
  awayGoals: {
    type: DataTypes.STRING(150),
    allowNull: true
  },

  homeOdds: {
    type: DataTypes.DECIMAL(5,2),
    allowNull: true
  },
  homeHasFireIcon: {
    type: DataTypes.BOOLEAN,
    defaultValue: false
  },

  drawOdds: {
    type: DataTypes.DECIMAL(5,2),
    allowNull: true
  },
  drawHasFireIcon: {
    type: DataTypes.BOOLEAN,
    defaultValue: false
  },

  awayOdds: {
    type: DataTypes.DECIMAL(5,2),
    allowNull: true
  },
  awayHasFireIcon: {
    type: DataTypes.BOOLEAN,
    defaultValue: false
  },

  betCount: {
    type: DataTypes.INTEGER,
    allowNull: true
  },

  hasBoostedOdds: {
    type: DataTypes.BOOLEAN,
    defaultValue: false
  },

  hasTwoUp: {
    type: DataTypes.BOOLEAN,
    defaultValue: false
  }

}, {
  tableName: 'live_matches',
  timestamps: true
});

module.exports = LiveMatch;