const { Op } = require('sequelize');
const { BookingCode } = require('../models');

/**
 * Create a new booking code
 */
const create = async (data) => {
  return await BookingCode.create(data);
};

/**
 * Find booking code by its code string
 */
const findByCode = async (code) => {
  return await BookingCode.findOne({
    where: { code }
  });
};

/**
 * Find active booking code (not expired)
 */
const findActiveByCode = async (code) => {
  const now = new Date();
  
  return await BookingCode.findOne({
    where: {
      code,
      status: 'ACTIVE',
      expiresAt: {
        [Op.gt]: now
      }
    }
  });
};

/**
 * Delete expired booking codes
 */
const deleteExpired = async () => {
  const now = new Date();
  return await BookingCode.destroy({
    where: {
      expiresAt: { [Op.lt]: now },
      status: 'EXPIRED'
    }
  });
};

module.exports = {
  create,
  findByCode,
  findActiveByCode,
  deleteExpired
};