const { getAppointments, applyCors } = require("./_lib");

module.exports = async function handler(req, res) {
  applyCors(res);

  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  try {
    const appointments = await getAppointments();
    const { date } = req.query;

    let filtered = appointments;
    if (date) {
      filtered = appointments.filter(a => a.appointment_date === date);
    }

    // Sort by date desc, then time asc
    filtered.sort((a, b) => {
      if (a.appointment_date !== b.appointment_date) {
        return b.appointment_date.localeCompare(a.appointment_date);
      }
      return a.appointment_time.localeCompare(b.appointment_time);
    });

    // Limit to 100
    res.status(200).json({ appointments: filtered.slice(0, 100) });
  } catch (err) {
    console.error("Appointments fetch error:", err);
    res.status(500).json({ error: "Failed to fetch appointments: " + err.message });
  }
};
