const depositService = require('../../services/deposit/deposit.service');

// ============ RECIPIENTS (admin) ============
async function getRecipients(req, res, next) {
  try {
    const result = await depositService.getRecipients();
    return res.status(result.status).json(result);
  } catch (err) {
    next(err);
  }
}

async function addRecipient(req, res, next) {
  try {
    const { phone_number, label } = req.body;
    const result = await depositService.addRecipient({ phone_number, label });
    return res.status(result.status).json(result);
  } catch (err) {
    next(err);
  }
}

async function removeRecipient(req, res, next) {
  try {
    const { id } = req.params;
    const result = await depositService.removeRecipient(id);
    return res.status(result.status).json(result);
  } catch (err) {
    next(err);
  }
}

// ============ CUSTOMER DEPOSIT REQUESTS ============
async function requestDeposit(req, res, next) {
  try {
    const { amount, payer_phone } = req.body;
    const result = await depositService.requestDeposit({
      user_id: req.user.id,
      amount,
      payer_phone,
    });
    return res.status(result.status).json(result);
  } catch (err) {
    next(err);
  }
}

async function getMyRequests(req, res, next) {
  try {
    const result = await depositService.getMyRequests(req.user.id);
    return res.status(result.status).json(result);
  } catch (err) {
    next(err);
  }
}

// ============ ADMIN DEPOSIT REQUESTS ============
async function getAllRequests(req, res, next) {
  try {
    const { status, limit, offset } = req.query;
    const result = await depositService.getAllRequests({ status, limit, offset });
    return res.status(result.status).json(result);
  } catch (err) {
    next(err);
  }
}

async function confirmRequest(req, res, next) {
  try {
    const { request_id, note } = req.body;
    const result = await depositService.confirmRequest({
      request_id,
      admin_id: req.user.id,
      note,
    });
    return res.status(result.status).json(result);
  } catch (err) {
    next(err);
  }
}

async function cancelRequest(req, res, next) {
  try {
    const { request_id, note } = req.body;
    const result = await depositService.cancelRequest({
      request_id,
      admin_id: req.user.id,
      note,
    });
    return res.status(result.status).json(result);
  } catch (err) {
    next(err);
  }
}

module.exports = {
  getRecipients,
  addRecipient,
  removeRecipient,
  requestDeposit,
  getMyRequests,
  getAllRequests,
  confirmRequest,
  cancelRequest,
};