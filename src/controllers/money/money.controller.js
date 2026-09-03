// controllers/money/money.controller.js
const moneyService = require('../../services/money/money.service');

// ============ DEPOSIT (PALMPESA) ============

// POST /api/money/deposit/palmpesa - initiate PalmPesa deposit
async function depositViaPalmPesa(req, res, next) {
  try {
    const { amount, phone_number } = req.body;
    const result = await moneyService.depositViaPalmPesa({
      user_id: req.user.id,
      amount,
      phone_number,
    });
    return res.status(result.status).json(result);
  } catch (err) {
    next(err);
  }
}

// POST /api/money/palmpesa-webhook - PUBLIC webhook (no auth)
async function palmPesaWebhook(req, res, next) {
  try {
    const { status, body } = await moneyService.palmPesaWebhook(req.body);
    return res.status(status).json(body);
  } catch (err) {
    console.error('Webhook handled error:', err.message);
    return res.status(200).json({ message: 'Webhook received', status: 'accepted' });
  }
}

// GET /api/money/payment/status/:transactionId
async function checkPalmPesaStatus(req, res, next) {
  try {
    const { transactionId } = req.params;
    const result = await moneyService.checkPalmPesaStatus({
      user_id: req.user.id,
      transactionId,
    });
    return res.status(result.status).json(result);
  } catch (err) {
    next(err);
  }
}

// ============ WITHDRAW (PENDING -> ADMIN ACCEPT/CANCEL) ============

// POST /api/money/withdraw - user requests withdraw (PENDING)
async function withdraw(req, res, next) {
  try {
    const { amount, phone_number } = req.body;
    const result = await moneyService.withdraw({
      user_id: req.user.id,
      amount,
      phone_number,
    });
    return res.status(result.status).json(result);
  } catch (err) {
    next(err);
  }
}

// GET /api/money/withdraw/my - user's own withdraw requests
async function getMyWithdrawRequests(req, res, next) {
  try {
    const result = await moneyService.getMyWithdrawRequests(req.user.id);
    return res.status(result.status).json(result);
  } catch (err) {
    next(err);
  }
}

// GET /api/money/withdraw/requests - admin sees all
async function getAllWithdrawRequests(req, res, next) {
  try {
    const { status, limit, offset } = req.query;
    const result = await moneyService.getAllWithdrawRequests({ status, limit, offset });
    return res.status(result.status).json(result);
  } catch (err) {
    next(err);
  }
}

// POST /api/money/withdraw/confirm - admin accepts (deduct DB balance)
async function confirmWithdraw(req, res, next) {
  try {
    const { request_id, note } = req.body;
    const result = await moneyService.confirmWithdraw({
      request_id,
      admin_id: req.user.id,
      note,
    });
    return res.status(result.status).json(result);
  } catch (err) {
    next(err);
  }
}

// POST /api/money/withdraw/cancel - admin cancels
async function cancelWithdraw(req, res, next) {
  try {
    const { request_id, note } = req.body;
    const result = await moneyService.cancelWithdraw({
      request_id,
      admin_id: req.user.id,
      note,
    });
    return res.status(result.status).json(result);
  } catch (err) {
    next(err);
  }
}

// ============ BALANCE ============

// GET /api/money/balance
async function balance(req, res, next) {
  try {
    const result = await moneyService.getBalance(req.user.id);
    return res.status(result.status).json(result);
  } catch (err) {
    next(err);
  }
}

module.exports = {
  depositViaPalmPesa,
  palmPesaWebhook,
  checkPalmPesaStatus,
  withdraw,
  getMyWithdrawRequests,
  getAllWithdrawRequests,
  confirmWithdraw,
  cancelWithdraw,
  balance,
};
