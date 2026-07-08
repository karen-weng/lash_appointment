const {
  SERVICES, getNextId, getAppointments, saveAppointments,
  getCustomers, saveCustomers, sendConfirmationEmail, applyCors,
} = require("./_lib");

module.exports = async function handler(req, res) {
  applyCors(res);

  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  // Vercel may parse body automatically, or we may need to parse it
  let data = req.body;
  if (!data || typeof data !== "object") {
    try {
      const chunks = [];
      for await (const chunk of req) chunks.push(chunk);
      const raw = Buffer.concat(chunks).toString();
      data = JSON.parse(raw);
    } catch (e) {
      return res.status(400).json({ error: "Invalid JSON body" });
    }
  }

  const required = ["first_name", "last_name", "email", "phone", "service_id", "date", "time"];
  for (const field of required) {
    if (!data[field]) {
      return res.status(400).json({ error: `Missing field: ${field}` });
    }
  }

  try {
    const appointments = await getAppointments();
    const customers = await getCustomers();

    // Check slot availability
    const existing = appointments.find(
      a => a.appointment_date === data.date && a.appointment_time === data.time && a.status === "confirmed"
    );
    if (existing) {
      return res.status(409).json({ error: "This time slot is no longer available" });
    }

    // Upsert customer
    let customer = customers.find(c => c.email === data.email);
    let customerId;
    if (customer) {
      customerId = customer.id;
      customer.first_name = data.first_name;
      customer.last_name = data.last_name;
      customer.phone = data.phone;
    } else {
      customerId = await getNextId("customer_id_counter");
      customers.push({
        id: customerId,
        first_name: data.first_name,
        last_name: data.last_name,
        email: data.email,
        phone: data.phone,
        created_at: new Date().toISOString(),
      });
    }
    await saveCustomers(customers);

    // Create appointment
    const apptId = await getNextId("appointment_id_counter");
    const service = SERVICES.find(s => s.id === parseInt(data.service_id));
    const newAppt = {
      id: apptId,
      customer_id: customerId,
      service_id: parseInt(data.service_id),
      appointment_date: data.date,
      appointment_time: data.time,
      status: "confirmed",
      notes: data.notes || "",
      created_at: new Date().toISOString(),
      confirmation_sent: 0,
      reminder_sent: 0,
      // Denormalized for convenience
      first_name: data.first_name,
      last_name: data.last_name,
      email: data.email,
      phone: data.phone,
      service_name: service ? service.name : "",
      duration_minutes: service ? service.duration_minutes : 0,
      price: service ? service.price : 0,
    };

    appointments.push(newAppt);
    await saveAppointments(appointments);

    // Send confirmation email
    try {
      const sent = await sendConfirmationEmail(
        data.email, `${data.first_name} ${data.last_name}`,
        service ? service.name : "", data.date, data.time,
        service ? service.price : 0, service ? service.duration_minutes : 0, apptId
      );
      if (sent) {
        newAppt.confirmation_sent = 1;
        await saveAppointments(appointments);
      }
    } catch (err) {
      console.error("Confirmation email failed:", err);
    }

    res.status(201).json({ success: true, appointment: newAppt });
  } catch (err) {
    console.error("Booking error:", err);
    res.status(500).json({ error: "Failed to create booking: " + err.message });
  }
};
