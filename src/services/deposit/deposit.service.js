const { sequelize, DepositRequest, DepositRecipient, User, Transaction } = require('../../models');
const userRepository = require('../../repositories/user/user.repository');
const notificationService = require('../notification/notification.service');
const CustomExceptions = require('../../middleware/CustomExceptions');
const responseBuilder = require('../../utils/response.builder');

const DEPOSIT_NOTIFY_TITLE = 'New Deposit Request';
const DEPOSIT_NOTIFY_TYPE = 'alert';

const generateReference = () => {
  return 'DEP' + Date.now() + Math.floor(1000 + Math.random() * 9000);
};

const formatMoney = (n) => {
  return new Intl.NumberFormat('en-TZ', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n || 0);
};

// =============================================
// RECIPIENTS MANAGEMENT (admin phones to alert)
// =============================================

const getRecipients = async () => {
  const recipients = await DepositRecipient.findAll({
    order: [['createdAt', 'DESC']],
  });
  return responseBuilder.success({
    message: 'Recipients fetched successfully',
    data: { recipients },
  });
};

const addRecipient = async ({ phone_number, label = null }) => {
  if (!phone_number || !String(phone_number).trim()) {
    throw new CustomExceptions('Phone number is required', 400);
  }
  const exists = await DepositRecipient.findOne({ where: { phone_number: String(phone_number).trim() } });
  if (exists) {
    throw new CustomExceptions('This number already receives deposit alerts', 400);
  }
  const recipient = await DepositRecipient.create({
    phone_number: String(phone_number).trim(),
    label: label || null,
  });
  return responseBuilder.success({
    status: 201,
    message: 'Recipient added successfully',
    data: { recipient },
  });
};

const removeRecipient = async (id) => {
  const recipient = await DepositRecipient.findByPk(id);
  if (!recipient) {
    throw new CustomExceptions('Recipient not found', 404);
  }
  await recipient.destroy();
  return responseBuilder.success({
    message: 'Recipient removed successfully',
    data: { id },
  });
};

// =============================================
// DEPOSIT REQUESTS
// =============================================

// Customer hits "Deposit" -> record request + alert subscribed admins
const requestDeposit = async ({ user_id, amount, payer_phone = null }) => {
  const amountNum = Number(amount);
  if (!amountNum || amountNum <= 0) {
    throw new CustomExceptions('Amount is required and must be greater than 0', 400);
  }

  const user = await userRepository.findById(user_id);
  if (!user) {
    throw new CustomExceptions('User not found', 404);
  }

  const request = await DepositRequest.create({
    user_id,
    amount: amountNum,
    payer_phone: payer_phone || user.phone_number || null,
    status: 'PENDING',
  });

  // Notify customer that request was received
  try {
    await notificationService.sendToUser({
      phone_number: user.phone_number,
      title: 'Deposit Request Sent',
      message: `Your request to fund TSh ${formatMoney(amountNum)} was received. Check your phone for the prompt to enter your PIN.`,
      type: 'info',
      metadata: { type: 'deposit_request', deposit_request_id: request.id, amount: amountNum, status: 'PENDING' },
    });
  } catch (err) {
    console.error('Deposit customer notify failed:', err.message);
  }

  // Alert all subscribed admin phones (in-app + future push hook)
  const recipients = await DepositRecipient.findAll({ where: { active: true } });
  const recipientPhones = recipients.map((r) => r.phone_number);
  // Ensure every ADMIN user gets notified (not only deposit_recipients).
  const admins = await User.findAll({ where: { role: 'ADMIN' } });
  const adminPhones = admins.map((u) => u.phone_number).filter(Boolean);
  const phones = [...new Set([...recipientPhones, ...adminPhones])];
  if (phones.length > 0) {
    try {
      await notificationService.sendToMultiple({
        phone_numbers: phones,
        title: DEPOSIT_NOTIFY_TITLE,
        message: `Deposit request of TSh ${formatMoney(amountNum)} from ${payer_phone || user.phone_number}`,
        type: DEPOSIT_NOTIFY_TYPE,
        metadata: {
          type: 'deposit_request',
          deposit_request_id: request.id,
          amount: amountNum,
          payer_phone: payer_phone || user.phone_number,
          status: 'PENDING',
        },
      });
    } catch (err) {
      // Recipients listed but not registered as users yet -> log only
      console.error('Deposit admin notify (in-app) skipped:', err.message);
    }
  }

  return responseBuilder.success({
    status: 201,
    message: 'Deposit request sent, waiting for admin approval',
    data: {
      deposit_request: {
        id: request.id,
        amount: request.amount,
        payer_phone: request.payer_phone,
        status: request.status,
        created_at: request.created_at,
      },
    },
  });
};

const getMyRequests = async (user_id) => {
  const requests = await DepositRequest.findAll({
    where: { user_id },
    order: [['createdAt', 'DESC']],
  });
  return responseBuilder.success({
    message: 'Deposit requests fetched',
    data: { deposit_requests: requests },
  });
};

const getAllRequests = async ({ status = null, limit = 50, offset = 0 } = {}) => {
  const where = {};
  if (status) where.status = status;

  const limitNum = parseInt(limit, 10);
  const offsetNum = parseInt(offset, 10);

  const { rows, count } = await DepositRequest.findAndCountAll({
    where,
    order: [['createdAt', 'DESC']],
    limit: isNaN(limitNum) ? 50 : limitNum,
    offset: isNaN(offsetNum) ? 0 : offsetNum,
    offset,
    include: [{ model: User, as: 'user', attributes: ['id', 'phone_number', 'role', 'balance'] }],
  });

  return responseBuilder.success({
    message: 'Deposit requests fetched',
    data: { deposit_requests: rows, total: count },
  });
};

// Admin confirms payment received -> credit user balance atomically
const confirmRequest = async ({ request_id, admin_id, note = null }) => {
  if (!request_id) {
    throw new CustomExceptions('Deposit request ID is required', 400);
  }

  let result;
  await sequelize.transaction(async (t) => {
    const request = await DepositRequest.findOne({
      where: { id: request_id, status: 'PENDING' },
      transaction: t,
      lock: t.LOCK.UPDATE,
    });
    if (!request) {
      throw new CustomExceptions('Deposit request not found or already processed', 400);
    }

    const user = await User.findByPk(request.user_id, { transaction: t, lock: t.LOCK.UPDATE });
    if (!user) {
      throw new CustomExceptions('User not found', 404);
    }

    const balanceBefore = Number(user.balance);
    const depositAmount = Number(request.amount);

    // Deposit bonus: deposit 150,000+ -> get flat 10,000 bonus
    const bonusAmount = depositAmount >= 150000 ? 10000 : 0;
    const newBalance = balanceBefore + depositAmount + bonusAmount;
    user.balance = newBalance;
    await user.save({ transaction: t });

    await Transaction.create(
      {
        reference: generateReference(),
        user_id: user.id,
        type: 'DEPOSIT',
        amount: depositAmount,
        balance_before: balanceBefore,
        balance_after: newBalance,
        status: 'SUCCESS',
        description: bonusAmount > 0
          ? `Deposit confirmed (request ${request.id}) + bonus TZS ${bonusAmount}`
          : `Deposit confirmed via admin (request ${request.id})`,
      },
      { transaction: t }
    );

    request.status = 'CONFIRMED';
    request.admin_id = admin_id || null;
    request.confirmed_at = new Date();
    if (note) request.note = note;
    await request.save({ transaction: t });

    result = { request, user, bonusAmount };
  });

  // Notify customer (after commit)
  try {
    await notificationService.sendToUser({
      phone_number: result.user.phone_number,
      title: 'Deposit Confirmed',
      message: result.bonusAmount > 0
        ? `TSh ${formatMoney(result.request.amount)} has been added to your balance plus bonus TZS ${formatMoney(result.bonusAmount)}. New balance: ${formatMoney(result.user.balance)}`
        : `TSh ${formatMoney(result.request.amount)} has been added to your balance. New balance: ${formatMoney(result.user.balance)}`,
      type: 'success',
      metadata: { type: 'deposit_confirmed', deposit_request_id: result.request.id, amount: result.request.amount, balance: result.user.balance },
    });
  } catch (err) {
    console.error('Deposit confirm notify failed:', err.message);
  }

  return responseBuilder.success({
    message: 'Deposit confirmed and balance updated',
    data: {
      deposit_request: {
        id: result.request.id,
        amount: result.request.amount,
        status: result.request.status,
        admin_id: result.request.admin_id,
        confirmed_at: result.request.confirmed_at,
      },
      balance: result.user.balance,
      bonus: {
        applied: result.bonusAmount > 0,
        amount: result.bonusAmount,
      },
    },
  });
};

const cancelRequest = async ({ request_id, admin_id, note = null }) => {
  if (!request_id) {
    throw new CustomExceptions('Deposit request ID is required', 400);
  }
  const request = await DepositRequest.findOne({ where: { id: request_id, status: 'PENDING' } });
  if (!request) {
    throw new CustomExceptions('Deposit request not found or already processed', 400);
  }
  request.status = 'CANCELLED';
  request.admin_id = admin_id || null;
  request.cancelled_at = new Date();
  if (note) request.note = note;
  await request.save();

  try {
    const user = await userRepository.findById(request.user_id);
    if (user) {
      await notificationService.sendToUser({
        phone_number: user.phone_number,
        title: 'Payment Failed',
        message: `Your payment of TSh ${formatMoney(request.amount)} was not completed. Please try again.`,
        type: 'warning',
        metadata: { type: 'deposit_cancelled', deposit_request_id: request.id, amount: request.amount },
      });
    }
  } catch (err) {
    console.error('Deposit cancel notify failed:', err.message);
  }

  return responseBuilder.success({
    message: 'Deposit request cancelled',
    data: { deposit_request: { id: request.id, status: request.status } },
  });
};

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