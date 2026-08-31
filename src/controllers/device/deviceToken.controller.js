// controllers/device/deviceToken.controller.js
const deviceTokenRepository = require('../../repositories/device/deviceToken.repository');
const responseBuilder = require('../../utils/response.builder');

// Register this device's FCM token for push notifications.
const registerToken = async (req, res, next) => {
  try {
    const { device_token, platform } = req.body;
    if (!device_token) {
      return res.status(400).json({
        success: false,
        status: 400,
        message: 'device_token is required',
      });
    }

    await deviceTokenRepository.register({
      user_id: req.user.id,
      token: String(device_token).trim(),
      platform: platform || 'android',
    });

    return res.status(200).json(
      responseBuilder.success({
        status: 200,
        message: 'Device registered for push notifications',
        data: { registered: true },
      })
    );
  } catch (err) {
    next(err);
  }
};

// Unregister this device (e.g. on logout) so it stops receiving pushes.
const unregisterToken = async (req, res, next) => {
  try {
    const { device_token } = req.body;
    if (device_token) {
      await deviceTokenRepository.unregister(String(device_token).trim());
    }
    return res.status(200).json(
      responseBuilder.success({
        status: 200,
        message: 'Device unregistered',
        data: { registered: false },
      })
    );
  } catch (err) {
    next(err);
  }
};

module.exports = {
  registerToken,
  unregisterToken,
};