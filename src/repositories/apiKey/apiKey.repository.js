const { ApiKey } = require('../../models');

const findByGateway = async (gateway) => ApiKey.findOne({ where: { gateway } });

const upsertCredentials = async (gateway, credentials) => {
  const [row] = await ApiKey.findOrCreate({
    where: { gateway },
    defaults: { gateway, credentials },
  });
  row.credentials = { ...(row.credentials || {}), ...credentials };
  await row.save();
  return row;
};

module.exports = {
  findByGateway,
  upsertCredentials,
};