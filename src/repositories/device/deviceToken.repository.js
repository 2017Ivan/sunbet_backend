const { Op } = require('sequelize');
const UserDevice = require('../../models/userDevice/userDevice.model');

// Register (or re-register) an FCM token for a user. A token belongs to one
// user: if it already exists under another user, ownership moves to this one.
const register = async ({ user_id, token, platform = 'android' }) => {
  if (!token) throw new Error('Device token is required');

  await UserDevice.destroy({
    where: { token, user_id: { [Op.ne]: user_id } },
  });

  const [row] = await UserDevice.findOrCreate({
    where: { token },
    defaults: { user_id, token, platform },
  });

  if (row.user_id !== user_id || row.platform !== platform) {
    row.user_id = user_id;
    row.platform = platform;
    await row.save();
  }
  return row;
};

const unregister = async (token) => {
  if (!token) return { removed: 0 };
  const removed = await UserDevice.destroy({ where: { token } });
  return { removed };
};

const findTokensByUserId = async (user_id) => {
  const rows = await UserDevice.findAll({
    where: { user_id },
    attributes: ['token'],
  });
  return rows.map((r) => r.token);
};

module.exports = {
  register,
  unregister,
  findTokensByUserId,
};