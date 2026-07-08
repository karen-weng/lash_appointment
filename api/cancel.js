const { getAppointments, saveAppointments, applyCors } = require("./_lib");

module.exports = async function handler(req, res) {
  applyCors(res);

  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  const { id } = req.query;
  if (!id) {
    return res.status(400).json({ error: "Appointment ID required" });
  }

  try {
    const appointments = await getAppointments();
    const appt = appointments.find(a => a.id === parseInt(id));
    if (appt) {
      appt.status = "cancelled";
      await saveAppointments(appointments);
    }

    res.status(200).json({ success: true });
  } catch (err) {
    console.error("Cancel error:", err);
    res.status(500).json({ error: "Failed to cancel appointment: " + err.message });
  }
};
