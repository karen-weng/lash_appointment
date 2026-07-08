const {
  getAppointments, saveAppointments,
  sendReminderEmail, REMINDER_HOURS_BEFORE, corsHeaders,
} = require("../_lib");

// This runs as a Vercel Cron Job every hour
// It checks for appointments coming up within REMINDER_HOURS_BEFORE hours
// and sends reminder emails

module.exports = async function handler(req, res) {
  // Security: verify this is called by Vercel Cron
  const authHeader = req.headers["authorization"];
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  try {
    const appointments = await getAppointments();
    const now = new Date();
    const cutoff = new Date(now.getTime() + REMINDER_HOURS_BEFORE * 60 * 60 * 1000);

    let remindersSent = 0;

    for (const appt of appointments) {
      if (appt.status !== "confirmed" || appt.reminder_sent) continue;

      const apptDate = new Date(`${appt.appointment_date}T${appt.appointment_time}:00`);
      if (now <= apptDate && apptDate <= cutoff) {
        const name = `${appt.first_name} ${appt.last_name}`;
        const sent = await sendReminderEmail(
          appt.email, name, appt.service_name,
          appt.appointment_date, appt.appointment_time
        );
        if (sent) {
          appt.reminder_sent = 1;
          remindersSent++;
        }
      }
    }

    if (remindersSent > 0) {
      await saveAppointments(appointments);
    }

    res.status(200).json({
      success: true,
      checked: appointments.filter(a => a.status === "confirmed" && !a.reminder_sent).length,
      remindersSent,
    });
  } catch (err) {
    console.error("Cron reminder error:", err);
    res.status(500).json({ error: err.message });
  }
};
