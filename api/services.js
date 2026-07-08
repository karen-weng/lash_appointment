const { SERVICES, applyCors } = require("./_lib");

module.exports = async function handler(req, res) {
  applyCors(res);

  if (req.method === "OPTIONS") return res.status(200).end();

  const { category } = req.query || {};
  let filtered = SERVICES;
  if (category) filtered = SERVICES.filter(s => s.category === category);

  return res.status(200).json({ services: filtered });
};
