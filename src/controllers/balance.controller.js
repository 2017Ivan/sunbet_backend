const { getBalance, updateBalanceAmount } = require('../services/balance.service');

/* GET balance */
const fetchBalance = async (req, res) => {
  try {
    const balance = await getBalance();
    return res.status(200).json(balance);
  } catch (error) {
    return res.status(404).json({ message: error.message });
  }
};

/* PATCH balance */
const updateAmount = async (req, res) => {
  try {
    const { amount } = req.body;
    const balance = await updateBalanceAmount(amount);
    return res.status(200).json(balance);
  } catch (error) {
    return res.status(400).json({ message: error.message });
  }
};

module.exports = {
  fetchBalance,
  updateAmount
};