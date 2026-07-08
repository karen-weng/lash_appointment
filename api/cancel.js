const { getAppointments, saveAppointments, corsHeaders } = require("./_lib");

module.exports = async function handler(req, res) {
  if (req.method === "OPTIONS") {
    return res.status(200).set(corsHeaders()).send("");
  }

  const { id } = req.query;
  if (!id) {
    return res.status(400).set(corsHeaders()).json({ error: "Appointment ID required" });
  }

  const appointments = await getAppointments();
  const appt = appointments.find(a => a.id === parseInt(id));
  if (appt) {
    appt.status = "cancelled";
    await saveAppointments(appointments);
  }

  res.status(200).set(corsHeaders()).json({ success: true });
};
