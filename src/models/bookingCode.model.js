const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

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

  selections: {
    type: DataTypes.JSON,
    allowNull: false,
    comment: 'Array of selected games with match details'
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

// Association - itaita automatic kutoka index.js
BookingCode.associate = (models) => {
  BookingCode.belongsTo(models.User, {
    foreignKey: 'userId',
    as: 'creator',
    targetKey: 'id'
  });
};

module.exports = BookingCode;