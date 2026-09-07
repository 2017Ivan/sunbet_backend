const { DataTypes } = require('sequelize');
const sequelize = require('../../config/database');

const HeroSlide = sequelize.define('HeroSlide', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true,
    allowNull: false,
  },
  slide_index: {
    type: DataTypes.INTEGER,
    allowNull: false,
    unique: true,
  },
  badge: {
    type: DataTypes.STRING(100),
    allowNull: true,
  },
  badgeBg: {
    type: DataTypes.STRING(100),
    allowNull: true,
  },
  badgeBorder: {
    type: DataTypes.STRING(100),
    allowNull: true,
  },
  badgeColor: {
    type: DataTypes.STRING(50),
    allowNull: true,
  },
  title: {
    type: DataTypes.TEXT,
    allowNull: true,
  },
  titleColor: {
    type: DataTypes.STRING(50),
    allowNull: true,
  },
  sub: {
    type: DataTypes.TEXT,
    allowNull: true,
  },
  cta: {
    type: DataTypes.STRING(100),
    allowNull: true,
  },
  ctaBg: {
    type: DataTypes.STRING(50),
    allowNull: true,
  },
  ctaColor: {
    type: DataTypes.STRING(50),
    allowNull: true,
  },
  bg: {
    type: DataTypes.TEXT,
    allowNull: true,
  },
  blob: {
    type: DataTypes.STRING(100),
    allowNull: true,
  },
  blob2: {
    type: DataTypes.STRING(100),
    allowNull: true,
  },
  route: {
    type: DataTypes.STRING(200),
    allowNull: true,
  },
  liveIndicator: {
    type: DataTypes.BOOLEAN,
    defaultValue: false,
  },
  thumb_image: {
    type: DataTypes.TEXT('long'),
    allowNull: true,
  },
  thumb_league: {
    type: DataTypes.STRING(100),
    allowNull: true,
  },
  thumb_live: {
    type: DataTypes.BOOLEAN,
    defaultValue: false,
  },
  thumb_time: {
    type: DataTypes.STRING(50),
    allowNull: true,
  },
  thumb_home: {
    type: DataTypes.STRING(100),
    allowNull: true,
  },
  thumb_homeShort: {
    type: DataTypes.STRING(10),
    allowNull: true,
  },
  thumb_homeColor: {
    type: DataTypes.STRING(50),
    allowNull: true,
  },
  thumb_homeOdds: {
    type: DataTypes.STRING(20),
    allowNull: true,
  },
  thumb_away: {
    type: DataTypes.STRING(100),
    allowNull: true,
  },
  thumb_awayShort: {
    type: DataTypes.STRING(10),
    allowNull: true,
  },
  thumb_awayColor: {
    type: DataTypes.STRING(50),
    allowNull: true,
  },
  thumb_awayOdds: {
    type: DataTypes.STRING(20),
    allowNull: true,
  },
  thumb_score: {
    type: DataTypes.STRING(20),
    allowNull: true,
  },
  thumb_foot1: {
    type: DataTypes.STRING(100),
    allowNull: true,
  },
  thumb_foot2: {
    type: DataTypes.STRING(100),
    allowNull: true,
  },
  thumb_foot2Color: {
    type: DataTypes.STRING(50),
    allowNull: true,
  },
  thumb_foot2Bg: {
    type: DataTypes.STRING(50),
    allowNull: true,
  },
  thumb_foot3: {
    type: DataTypes.STRING(100),
    allowNull: true,
  },
}, {
  tableName: 'hero_slides',
  timestamps: true,
  indexes: [
    { fields: ['slide_index'], unique: true }
  ]
});

module.exports = HeroSlide;
