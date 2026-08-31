const { DataTypes } = require('sequelize');
const sequelize = require('../../config/database');

// A device (FCM token) that belongs to a user, for push notifications.
const UserDevice = sequelize.define('UserDevice', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true,
    allowNull: false,
  },
  user_id: {
    type: DataTypes.UUID,
    allowNull: false,
  },
  token: {
    type: DataTypes.STRING(255),
    allowNull: false,
    unique: true,
  },
  platform: {
    type: DataTypes.ENUM('android', 'ios', 'web'),
    allowNull: false,
    defaultValue: 'android',
  },
}, {
  tableName: 'user_devices',
  timestamps: true,
  indexes: [
    { fields: ['user_id'] },
    { fields: ['token'], unique: true },
  ],
});

module.exports = UserDevice;