const { SERVICES, corsHeaders } = require("./_lib");

module.exports = async function handler(req, res) {
  if (req.method === "OPTIONS") {
    return res.status(200).set(corsHeaders()).send("");
  }

  const categories = [...new Set(SERVICES.map(s => s.category))];
  res.status(200).set(corsHeaders()).json({ categories });
};
