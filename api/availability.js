const { SERVICES, BUSINESS_HOURS, getAppointments, applyCors } = require("./_lib");

module.exports = async function handler(req, res) {
  applyCors(res);

  if (req.method === "OPTIONS") return res.status(200).end();

  const { date, service_id } = req.query || {};
  if (!date || !service_id) {
    return res.status(400).json({ error: "date and service_id required" });
  }

  const service = SERVICES.find(s => s.id === parseInt(service_id));
  if (!service) return res.status(404).json({ error: "Service not found" });

  try {
    const dayOfWeek = new Date(date + "T12:00:00").getDay();
    const bh = BUSINESS_HOURS.find(h => h.day_of_week === dayOfWeek);
    if (!bh || !bh.is_open) {
      return res.status(200).json({ slots: [], closed: true, message: "We are closed on this day" });
    }

    const appointments = await getAppointments();
    const bookedTimes = new Set(
      appointments
        .filter(a => a.appointment_date === date && a.status === "confirmed")
        .map(a => a.appointment_time)
    );

    const [openH, openM] = bh.open_time.split(":").map(Number);
    const [closeH, closeM] = bh.close_time.split(":").map(Number);
    const openMin = openH * 60 + openM;
    const closeMin = closeH * 60 + closeM;
    const lastStart = closeMin - service.duration_minutes;

    const slots = [];
    for (let mins = openMin; mins <= lastStart; mins += 30) {
      const h = Math.floor(mins / 60);
      const m = mins % 60;
      const t = String(h).padStart(2, "0") + ":" + String(m).padStart(2, "0");
      const h12 = h % 12 || 12;
      const ampm = h >= 12 ? "PM" : "AM";
      slots.push({
        time: t,
        available: !bookedTimes.has(t),
        display: h12 + ":" + String(m).padStart(2, "0") + " " + ampm,
      });
    }

    return res.status(200).json({ slots, closed: false });
  } catch (err) {
    console.error("Availability error:", err);
    return res.status(500).json({ error: "Failed to check availability: " + err.message });
  }
};
