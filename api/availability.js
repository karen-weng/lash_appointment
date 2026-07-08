const { SERVICES, BUSINESS_HOURS, corsHeaders } = require("./_lib");
const { getAppointments } = require("./_lib");

module.exports = async function handler(req, res) {
  if (req.method === "OPTIONS") {
    return res.status(200).set(corsHeaders()).send("");
  }

  const { date, service_id } = req.query;
  if (!date || !service_id) {
    return res.status(400).set(corsHeaders()).json({ error: "date and service_id required" });
  }

  const service = SERVICES.find(s => s.id === parseInt(service_id));
  if (!service) {
    return res.status(404).set(corsHeaders()).json({ error: "Service not found" });
  }

  // Check business hours for this day
  const dayOfWeek = new Date(date + "T12:00:00").getDay();
  const bh = BUSINESS_HOURS.find(h => h.day_of_week === dayOfWeek);
  if (!bh || !bh.is_open) {
    return res.status(200).set(corsHeaders()).json({ slots: [], closed: true, message: "We are closed on this day" });
  }

  // Get booked slots
  const appointments = await getAppointments();
  const bookedTimes = new Set(
    appointments
      .filter(a => a.appointment_date === date && a.status === "confirmed")
      .map(a => a.appointment_time)
  );

  // Generate 30-min slots
  const [openH, openM] = bh.open_time.split(":").map(Number);
  const [closeH, closeM] = bh.close_time.split(":").map(Number);
  const openMin = openH * 60 + openM;
  const closeMin = closeH * 60 + closeM;
  const lastStart = closeMin - service.duration_minutes;

  const slots = [];
  for (let mins = openMin; mins <= lastStart; mins += 30) {
    const t = `${String(Math.floor(mins / 60)).padStart(2, "0")}:${String(mins % 60).padStart(2, "0")}`;
    slots.push({
      time: t,
      available: !bookedTimes.has(t),
      display: formatTime(t),
    });
  }

  res.status(200).set(corsHeaders()).json({ slots, closed: false });
};

function formatTime(t) {
  const [h, m] = t.split(":").map(Number);
  const ampm = h >= 12 ? "PM" : "AM";
  const h12 = h % 12 || 12;
  return `${h12}:${String(m).padStart(2, "0")} ${ampm}`;
}
