const { SERVICES, corsHeaders } = require("./_lib");

module.exports = async function handler(req, res) {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return res.status(200).set(corsHeaders()).send("");
  }

  const { category } = req.query;
  let filtered = SERVICES;
  if (category) {
    filtered = SERVICES.filter(s => s.category === category);
  }

  res.status(200).set(corsHeaders()).json({ services: filtered });
};
