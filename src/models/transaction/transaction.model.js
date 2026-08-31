const { DataTypes } = require('sequelize');
const sequelize = require('../../config/database');

const Transaction = sequelize.define('Transaction', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true,
    allowNull: false,
  },
  reference: {
    type: DataTypes.STRING(50),
    allowNull: false,
    unique: true,
  },
  user_id: {
    type: DataTypes.UUID,
    allowNull: false,
  },
  type: {
    type: DataTypes.ENUM('DEPOSIT', 'WITHDRAWAL', 'BET_PLACED', 'BET_WON', 'BET_REFUND', 'REWARD'),
    allowNull: false,
  },
  amount: {
    type: DataTypes.DECIMAL(12, 2),
    allowNull: false,
  },
  balance_before: {
    type: DataTypes.DECIMAL(12, 2),
    allowNull: false,
  },
  balance_after: {
    type: DataTypes.DECIMAL(12, 2),
    allowNull: false,
  },
  status: {
    type: DataTypes.ENUM('SUCCESS', 'FAILED', 'PENDING'),
    allowNull: false,
    defaultValue: 'SUCCESS',
  },
  description: {
    type: DataTypes.STRING,
    allowNull: true,
  }
}, {
  tableName: 'transactions',
  timestamps: true,
  indexes: [
    { unique: true, fields: ['reference'] },
    { fields: ['user_id'] },
    { fields: ['type'] }
  ]
});

module.exports = Transaction;