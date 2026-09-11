const { DataTypes } = require('sequelize');
const sequelize = require('../../config/database');

const ApiKey = sequelize.define(
  'ApiKey',
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
      allowNull: false,
    },
    gateway: {
      type: DataTypes.STRING(30),
      allowNull: false,
      unique: true,
    },
    credentials: {
      type: DataTypes.JSON,
      allowNull: false,
      defaultValue: {},
    },
  },
  {
    tableName: 'api_keys',
    timestamps: true,
    indexes: [{ unique: true, fields: ['gateway'] }],
  }
);

module.exports = ApiKey;