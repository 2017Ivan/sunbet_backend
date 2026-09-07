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

// Customer hits "Deposit" -> credit the balance IMMEDIATELY (no admin
// approval needed). A read-only notification is sent to admins so they
// are aware, but they can no longer accept/cancel a deposit.
const requestDeposit = async ({ user_id, amount, payer_phone = null }) => {
  const amountNum = Number(amount);
  if (!amountNum || amountNum <= 0) {
    throw new CustomExceptions('Amount is required and must be greater than 0', 400);
  }

  const user = await userRepository.findById(user_id);
  if (!user) {
    throw new CustomExceptions('User not found', 404);
  }

  // Deposit bonus: deposit 150,000+ -> get flat 10,000 bonus
  const bonusAmount = amountNum >= 150000 ? 10000 : 0;

  let request;
  let creditedUser;

  await sequelize.transaction(async (t) => {
    const lockedUser = await User.findByPk(user.id, { transaction: t, lock: t.LOCK.UPDATE });
    if (!lockedUser) throw new CustomExceptions('User not found', 404);

    const balanceBefore = Number(lockedUser.balance);
    const newBalance = parseFloat((balanceBefore + amountNum + bonusAmount).toFixed(2));
    lockedUser.balance = newBalance;
    await lockedUser.save({ transaction: t });

    await Transaction.create(
      {
        reference: generateReference(),
        user_id: lockedUser.id,
        type: 'DEPOSIT',
        amount: amountNum,
        balance_before: balanceBefore,
        balance_after: newBalance,
        status: 'SUCCESS',
        description: bonusAmount > 0
          ? `Auto deposit + bonus TZS ${bonusAmount}`
          : 'Auto deposit',
      },
      { transaction: t }
    );

    request = await DepositRequest.create(
      {
        user_id: lockedUser.id,
        amount: amountNum,
        payer_phone: payer_phone || lockedUser.phone_number || null,
        status: 'CONFIRMED',
        confirmed_at: new Date(),
      },
      { transaction: t }
    );

    creditedUser = lockedUser;
  });

  // Notify customer that the balance was credited successfully
  try {
    await notificationService.sendToUser({
      phone_number: creditedUser.phone_number,
      title: 'Deposit Successful',
      message: bonusAmount > 0
        ? `TSh ${formatMoney(amountNum)} has been added to your balance plus bonus TZS ${formatMoney(bonusAmount)}. New balance: ${formatMoney(creditedUser.balance)}`
        : `TSh ${formatMoney(amountNum)} has been added to your balance. New balance: ${formatMoney(creditedUser.balance)}`,
      type: 'success',
      metadata: { type: 'deposit_confirmed', deposit_request_id: request.id, amount: amountNum, balance: creditedUser.balance, status: 'CONFIRMED' },
    });
  } catch (err) {
    console.error('Deposit customer notify failed:', err.message);
  }

  // Read-only alert to all subscribed admin phones (admins only view it,
  // there is NO accept/cancel for deposits anymore).
  const recipients = await DepositRecipient.findAll({ where: { active: true } });
  const recipientPhones = recipients.map((r) => r.phone_number);
  const admins = await User.findAll({ where: { role: 'ADMIN' } });
  const adminPhones = admins.map((u) => u.phone_number).filter(Boolean);
  const phones = [...new Set([...recipientPhones, ...adminPhones])];
  if (phones.length > 0) {
    try {
      await notificationService.sendToMultiple({
        phone_numbers: phones,
        title: DEPOSIT_NOTIFY_TITLE,
        message: `Deposit of TSh ${formatMoney(amountNum)} from ${payer_phone || creditedUser.phone_number} — auto-credited.`,
        type: DEPOSIT_NOTIFY_TYPE,
        metadata: {
          type: 'deposit_request',
          deposit_request_id: request.id,
          amount: amountNum,
          payer_phone: payer_phone || creditedUser.phone_number,
          status: 'CONFIRMED',
        },
      });
    } catch (err) {
      // Recipients listed but not registered as users yet -> log only
      console.error('Deposit admin notify (in-app) skipped:', err.message);
    }
  }

  return responseBuilder.success({
    status: 201,
    message: 'Deposit successful, balance updated',
    data: {
      deposit_request: {
        id: request.id,
        amount: request.amount,
        payer_phone: request.payer_phone,
        status: request.status,
        confirmed_at: request.confirmed_at,
      },
      balance: creditedUser.balance,
      bonus: {
        applied: bonusAmount > 0,
        amount: bonusAmount,
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

// NOTE: Admin accept/cancel for deposits was REMOVED. Every deposit is
// auto-credited on request (see requestDeposit above).

module.exports = {
  getRecipients,
  addRecipient,
  removeRecipient,
  requestDeposit,
  getMyRequests,
  getAllRequests,
};