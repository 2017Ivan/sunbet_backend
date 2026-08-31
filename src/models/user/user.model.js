const { DataTypes } = require('sequelize');
const sequelize = require('../../config/database');

const User = sequelize.define('User', {
  id: { 
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true,
    allowNull: false,
  },
  phone_number: {
    type: DataTypes.STRING(20),
    allowNull: false,
    unique: {
      msg: 'Namba hii ya simu imeshasajiliwa.'
    },
    validate: {
      notEmpty: { msg: 'Namba ya simu inahitajika.' },
      is: {
        args: /^[\d+\-()\s]+$/i,
        msg: 'Ingiza namba halali ya simu.'
      }
    }
  },
  password: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  balance: {
    type: DataTypes.DECIMAL(12, 2),
    allowNull: false,
    defaultValue: 0.00,
    validate: {
      min: 0.00
    }
  },
  role: {
    type: DataTypes.ENUM('USER', 'AGENT', 'ADMIN'),
    allowNull: false,
    defaultValue: 'USER',
    validate: {
      isIn: [['USER', 'AGENT', 'ADMIN']]
    }
  },
  status: {
    type: DataTypes.ENUM('ACTIVE', 'SUSPENDED', 'BLOCKED'),
    allowNull: false,
    defaultValue: 'ACTIVE'
  },
  promo_code: {
    type: DataTypes.STRING(50),
    allowNull: true,
    defaultValue: null
  },
  promo_bonus_applied: {
    type: DataTypes.BOOLEAN,
    allowNull: false,
    defaultValue: false
  },
  daily_streak: {
    type: DataTypes.INTEGER,
    allowNull: false,
    defaultValue: 0
  },
  last_daily_claim: {
    type: DataTypes.DATEONLY,
    allowNull: true,
    defaultValue: null
  },
  total_daily_rewards: {
    type: DataTypes.DECIMAL(12, 2),
    allowNull: false,
    defaultValue: 0.00
  }
}, {
  tableName: 'users',
  timestamps: true,
  indexes: [
    { unique: true, fields: ['phone_number'] },
    { fields: ['role'] },
    { fields: ['status'] }
  ]
});

module.exports = User;