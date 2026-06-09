// user.model.js



const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');
const { v4: uuidv4 } = require('uuid');


const User = sequelize.define('User', {
  id: { 
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true,
    allowNull: false,
  },
  
 
  phone_number: {
    type: DataTypes.STRING(20),
    allowNull: true,
    unique: true,
    validate: {
      is: /^[\d+\-()\s]+$/i,
    }
  },
  password: {
    type: DataTypes.TEXT,
    allowNull: false,
  },
  balance: {
    type: DataTypes.DECIMAL(10,2),
    allowNull: false,
    defaultValue: 0.00
  }
  
}, {
  tableName: 'users',
  timestamps: true,
});


// Define association - User has many Bets
User.associate = (models) => {
  User.hasMany(models.Bet, {
    foreignKey: 'userId',
    as: 'bets',
    onDelete: 'CASCADE'
  });
};


module.exports = User;



