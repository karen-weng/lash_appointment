const { SERVICES, applyCors } = require("./_lib");

module.exports = async function handler(req, res) {
  applyCors(res);

  if (req.method === "OPTIONS") return res.status(200).end();

  const categories = [...new Set(SERVICES.map(s => s.category))];
  return res.status(200).json({ categories });
};
