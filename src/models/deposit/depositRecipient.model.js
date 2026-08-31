const { DataTypes } = require('sequelize');
const sequelize = require('../../config/database');

const DepositRecipient = sequelize.define(
  'DepositRecipient',
  {
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
        msg: 'This number already receives deposit alerts.',
      },
      validate: {
        notEmpty: { msg: 'Phone number is required.' },
        is: {
          args: /^[\d+\-()\s]+$/i,
          msg: 'Ingiza namba halali ya simu.',
        },
      },
    },
    label: {
      type: DataTypes.STRING(50),
      allowNull: true,
    },
    active: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: true,
    },
  },
  {
    tableName: 'deposit_recipients',
    timestamps: true,
    indexes: [{ fields: ['phone_number'] }],
  }
);

module.exports = DepositRecipient;