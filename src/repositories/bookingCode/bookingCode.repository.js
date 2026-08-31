// repositories/bookingCode/bookingCode.repository.js
// Booking code repository — methods za kuhifadhi na kutafuta booking codes.

const { BookingCode, User } = require('../../models');
const { Op } = require('sequelize');

// Create booking code
const createBookingCode = async (bookingData, transaction = null) => {
  return await BookingCode.create(bookingData, { transaction });
};

// Tafuta kwa code (aktive tu)
const findBookingCodeByCode = async (code) => {
  return await BookingCode.findOne({
    where: {
      code,
      is_active: true
    }
  });
};

// Tafuta kwa id
const findBookingCodeById = async (id) => {
  return await BookingCode.findByPk(id);
};

// Mara moja fanya isiwe active (wakati umepita / mechi imeanza)
const deactivateBookingCode = async (code, transaction = null) => {
  const [updatedRows] = await BookingCode.update(
    { is_active: false },
    { where: { code }, transaction }
  );
  return updatedRows > 0;
};

// Orodha ya booking codes za hivi karibuni (kwa admin / kuangalia)
const listRecentBookingCodes = async (limit = 50) => {
  return await BookingCode.findAll({
    order: [['createdAt', 'DESC']],
    limit
  });
};

// ADMIN: booking codes zote zilizoundwa kwenye mfumo.
// Search: kwa code yenyewe (mf. BC-8X92A) / status: ACTIVE | EXPIRED | DEACTIVATED
const listBookingCodesAdmin = async ({
  search = '',
  status = '',
  limit = 50,
  offset = 0
} = {}) => {
  const where = {};

  if (search) {
    where.code = { [Op.like]: `%${search}%` };
  }

  const now = new Date();
  if (status === 'ACTIVE') {
    where.is_active = true;
    where.expires_at = { [Op.gt]: now };
  } else if (status === 'EXPIRED') {
    where.is_active = true;
    where.expires_at = { [Op.lte]: now };
  } else if (status === 'DEACTIVATED') {
    where.is_active = false;
  }

  const intLimit = parseInt(limit, 10) || 50;
  const intOffset = parseInt(offset, 10) || 0;

  return await BookingCode.findAndCountAll({
    where,
    include: [
      {
        model: User,
        as: 'creator',
        attributes: ['id', 'phone_number', 'role', 'status'],
        required: false
      }
    ],
    order: [['createdAt', 'DESC']],
    limit: intLimit,
    offset: intOffset,
    distinct: true
  });
};

module.exports = {
  createBookingCode,
  findBookingCodeByCode,
  findBookingCodeById,
  deactivateBookingCode,
  listRecentBookingCodes,
  listBookingCodesAdmin
};
