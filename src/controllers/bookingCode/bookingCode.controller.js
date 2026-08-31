
// controllers/bookingCode/bookingCode.controller.js 

const bookingCodeService = require('../../services/bookingCode/bookingCode.service');

const createBookingCode = async (req, res, next) => {
  try {
    const { selections } = req.body;

    // Haipitishi tena creatorId
    const bookingCode = await bookingCodeService.createBookingCode({ selections });

    return res.status(201).json({
      success: true,
      message: 'Booking code imetengenezwa kikamilifu.',
      data: bookingCode
    });
  } catch (err) {
    next(err);
  }
};

const getBookingCodeDetails = async (req, res, next) => {
  try {
    const { code } = req.params;
    const details = await bookingCodeService.getBookingCodeDetails(code);

    return res.status(200).json({
      success: true,
      data: details
    });
  } catch (err) {
    next(err);
  }
};

const getAllBookingCodes = async (req, res, next) => {
  try {
    const { search, status, limit, offset } = req.query;
    const result = await bookingCodeService.getAllBookingCodesAdmin({ search, status, limit, offset });

    return res.status(200).json({
      success: true,
      data: result
    });
  } catch (err) {
    next(err);
  }
};

module.exports = {
  createBookingCode,
  getBookingCodeDetails,
  getAllBookingCodes
};