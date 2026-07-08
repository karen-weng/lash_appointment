// ══════════════════════════════════════════════════════════
// Shared library — database, email, seed data
// ══════════════════════════════════════════════════════════

const { kv } = require("@vercel/kv");

// ─── Config ──────────────────────────────────────────────
const BUSINESS_NAME = "Luxe Lashes";
const BUSINESS_EMAIL = "hello@luxelashes.com";
const BUSINESS_PHONE = "(555) 123-4567";
const REMINDER_HOURS_BEFORE = 1;

// SMTP config — set these in Vercel Environment Variables
const SMTP_HOST = process.env.SMTP_HOST || "smtp.gmail.com";
const SMTP_PORT = parseInt(process.env.SMTP_PORT || "587");
const SMTP_USER = process.env.SMTP_USER || "";
const SMTP_PASS = process.env.SMTP_PASS || "";

// ─── Seed Data ───────────────────────────────────────────
const SERVICES = [
  { id: 1,  name: "Classic Full Set",         description: "Natural-looking one-on-one lash extension application", duration_minutes: 120, price: 150.00, category: "Classic",   is_popular: 1 },
  { id: 2,  name: "Classic Refill",            description: "Touch-up for classic lash set (2-3 weeks)",             duration_minutes: 60,  price: 65.00,  category: "Classic",   is_popular: 0 },
  { id: 3,  name: "Classic Mega Full Set",     description: "Dramatic classic set with maximum density",            duration_minutes: 150, price: 185.00, category: "Classic",   is_popular: 0 },
  { id: 4,  name: "Volume Full Set",           description: "Handmade volume fans for a fluffy, dramatic look",      duration_minutes: 150, price: 200.00, category: "Volume",    is_popular: 1 },
  { id: 5,  name: "Volume Refill",             description: "Touch-up for volume lash set (2-3 weeks)",             duration_minutes: 75,  price: 85.00,  category: "Volume",    is_popular: 0 },
  { id: 6,  name: "Mega Volume Full Set",      description: "Ultra-dramatic mega volume lash application",          duration_minutes: 180, price: 250.00, category: "Volume",    is_popular: 0 },
  { id: 7,  name: "Mega Volume Refill",        description: "Touch-up for mega volume set",                        duration_minutes: 90,  price: 100.00, category: "Volume",    is_popular: 0 },
  { id: 8,  name: "Hybrid Full Set",           description: "Mix of classic & volume for textured look",            duration_minutes: 135, price: 175.00, category: "Hybrid",    is_popular: 1 },
  { id: 9,  name: "Hybrid Refill",             description: "Touch-up for hybrid lash set",                        duration_minutes: 70,  price: 75.00,  category: "Hybrid",    is_popular: 0 },
  { id: 10, name: "Wispy Cat Eye Full Set",    description: "Elongated outer corners for a cat-eye effect",         duration_minutes: 140, price: 190.00, category: "Wispy",     is_popular: 0 },
  { id: 11, name: "Wispy Refill",              description: "Touch-up for wispy lash set",                         duration_minutes: 75,  price: 80.00,  category: "Wispy",     is_popular: 0 },
  { id: 12, name: "Lash Lift",                 description: "Natural lash perm for a lifted, curled look",          duration_minutes: 60,  price: 75.00,  category: "Lash Lift", is_popular: 1 },
  { id: 13, name: "Lash Lift & Tint",          description: "Lash lift plus tinting for darker, defined lashes",    duration_minutes: 75,  price: 95.00,  category: "Lash Lift", is_popular: 0 },
  { id: 14, name: "Lash Tint Only",            description: "Professional tinting for natural lashes",              duration_minutes: 30,  price: 35.00,  category: "Lash Lift", is_popular: 0 },
  { id: 15, name: "Lash Removal",              description: "Safe removal of existing lash extensions",             duration_minutes: 30,  price: 30.00,  category: "Other",     is_popular: 0 },
  { id: 16, name: "Lash Bath Add-on",          description: "Deep cleanse & conditioning treatment",                duration_minutes: 15,  price: 20.00,  category: "Other",     is_popular: 0 },
];

const BUSINESS_HOURS = [
  { day_of_week: 0, open_time: "10:00", close_time: "17:00", is_open: false },
  { day_of_week: 1, open_time: "09:00", close_time: "19:00", is_open: true },
  { day_of_week: 2, open_time: "09:00", close_time: "19:00", is_open: true },
  { day_of_week: 3, open_time: "09:00", close_time: "19:00", is_open: true },
  { day_of_week: 4, open_time: "09:00", close_time: "19:00", is_open: true },
  { day_of_week: 5, open_time: "09:00", close_time: "19:00", is_open: true },
  { day_of_week: 6, open_time: "09:00", close_time: "17:00", is_open: true },
];

// ─── KV Helpers ──────────────────────────────────────────
async function getNextId(key) {
  const current = (await kv.get(key)) || 0;
  const next = current + 1;
  await kv.set(key, next);
  return next;
}

async function getAppointments() {
  return (await kv.get("appointments")) || [];
}

async function saveAppointments(appointments) {
  await kv.set("appointments", appointments);
}

async function getCustomers() {
  return (await kv.get("customers")) || [];
}

async function saveCustomers(customers) {
  await kv.set("customers", customers);
}

// ─── Email ───────────────────────────────────────────────
async function sendConfirmationEmail(customerEmail, customerName, serviceName, apptDate, apptTime, price, duration, apptId) {
  if (!SMTP_USER || !SMTP_PASS) {
    console.log(`📧 [CONFIRMATION] Would send to ${customerEmail}: Booking #${apptId} confirmed`);
    return true;
  }

  const nodemailer = require("nodemailer");
  const niceDate = formatDateNice(apptDate);
  const niceTime = formatTimeNice(apptTime);

  try {
    const transporter = nodemailer.createTransport({
      host: SMTP_HOST, port: SMTP_PORT, secure: false,
      auth: { user: SMTP_USER, pass: SMTP_PASS },
    });

    await transporter.sendMail({
      from: `"${BUSINESS_NAME}" <${SMTP_USER}>`,
      to: customerEmail,
      subject: `✅ Booking Confirmed — ${BUSINESS_NAME}`,
      text: `Hi ${customerName},\n\nYour appointment has been confirmed!\n\nConfirmation #: ${apptId}\nDate: ${niceDate}\nTime: ${niceTime}\nService: ${serviceName}\nDuration: ${duration} minutes\nPrice: $${price.toFixed(2)}\n\nYou'll receive a reminder 1 hour before.\n\nContact us: ${BUSINESS_EMAIL} | ${BUSINESS_PHONE}\n\n— ${BUSINESS_NAME}`,
      html: `<div style="font-family:Arial,sans-serif;max-width:500px;margin:0 auto;color:#2d2d2d;">
        <div style="background:linear-gradient(135deg,#a06560,#c4837f);padding:30px;border-radius:12px 12px 0 0;text-align:center;">
          <h1 style="color:white;margin:0;font-size:1.5em;">${BUSINESS_NAME}</h1>
          <p style="color:rgba(255,255,255,0.9);margin:8px 0 0;">Booking Confirmed!</p>
        </div>
        <div style="background:white;padding:28px;border-radius:0 0 12px 12px;border:1px solid #e8e4e1;">
          <p>Hi ${customerName},</p>
          <p>Your appointment has been confirmed!</p>
          <table style="width:100%;border-collapse:collapse;">
            <tr><td style="padding:10px 0;border-bottom:1px solid #f0f0f0;color:#6b6b6b;">Confirmation #</td><td style="padding:10px 0;border-bottom:1px solid #f0f0f0;font-weight:600;">${apptId}</td></tr>
            <tr><td style="padding:10px 0;border-bottom:1px solid #f0f0f0;color:#6b6b6b;">Date</td><td style="padding:10px 0;border-bottom:1px solid #f0f0f0;font-weight:600;">${niceDate}</td></tr>
            <tr><td style="padding:10px 0;border-bottom:1px solid #f0f0f0;color:#6b6b6b;">Time</td><td style="padding:10px 0;border-bottom:1px solid #f0f0f0;font-weight:600;">${niceTime}</td></tr>
            <tr><td style="padding:10px 0;border-bottom:1px solid #f0f0f0;color:#6b6b6b;">Service</td><td style="padding:10px 0;border-bottom:1px solid #f0f0f0;font-weight:600;">${serviceName}</td></tr>
            <tr><td style="padding:10px 0;border-bottom:1px solid #f0f0f0;color:#6b6b6b;">Duration</td><td style="padding:10px 0;border-bottom:1px solid #f0f0f0;font-weight:600;">${duration} minutes</td></tr>
            <tr><td style="padding:10px 0;border-bottom:1px solid #f0f0f0;color:#6b6b6b;">Price</td><td style="padding:10px 0;border-bottom:1px solid #f0f0f0;font-weight:600;color:#a06560;font-size:1.1em;">$${price.toFixed(2)}</td></tr>
          </table>
          <p style="margin-top:20px;padding:14px;background:#f5e6e4;border-radius:8px;font-size:0.9em;">⏰ You will receive a reminder 1 hour before your appointment.</p>
          <p style="margin-top:16px;font-size:0.9em;color:#6b6b6b;">Need to reschedule? Contact us at ${BUSINESS_EMAIL} or ${BUSINESS_PHONE}</p>
        </div>
      </div>`,
    });
    console.log(`✅ Confirmation sent to ${customerEmail}`);
    return true;
  } catch (err) {
    console.error(`❌ Confirmation email error: ${err.message}`);
    return false;
  }
}

async function sendReminderEmail(customerEmail, customerName, serviceName, apptDate, apptTime) {
  if (!SMTP_USER || !SMTP_PASS) {
    console.log(`📧 [REMINDER] Would send to ${customerEmail}: Reminder for ${serviceName}`);
    return true;
  }

  const nodemailer = require("nodemailer");
  const niceDate = formatDateNice(apptDate);
  const niceTime = formatTimeNice(apptTime);

  try {
    const transporter = nodemailer.createTransport({
      host: SMTP_HOST, port: SMTP_PORT, secure: false,
      auth: { user: SMTP_USER, pass: SMTP_PASS },
    });

    await transporter.sendMail({
      from: `"${BUSINESS_NAME}" <${SMTP_USER}>`,
      to: customerEmail,
      subject: `⏰ Appointment Reminder — ${BUSINESS_NAME}`,
      text: `Hi ${customerName},\n\n⏰ Your appointment is in 1 HOUR!\n\nDate: ${niceDate}\nTime: ${niceTime}\nService: ${serviceName}\n\nContact us: ${BUSINESS_EMAIL} | ${BUSINESS_PHONE}\n\n— ${BUSINESS_NAME}`,
      html: `<div style="font-family:Arial,sans-serif;max-width:500px;margin:0 auto;color:#2d2d2d;">
        <div style="background:linear-gradient(135deg,#a06560,#c4837f);padding:30px;border-radius:12px 12px 0 0;text-align:center;">
          <h1 style="color:white;margin:0;font-size:1.5em;">⏰ ${BUSINESS_NAME}</h1>
          <p style="color:rgba(255,255,255,0.9);margin:8px 0 0;">Appointment Reminder</p>
        </div>
        <div style="background:white;padding:28px;border-radius:0 0 12px 12px;border:1px solid #e8e4e1;">
          <p>Hi ${customerName},</p>
          <p style="font-size:1.1em;font-weight:600;">Your appointment is in 1 HOUR!</p>
          <table style="width:100%;border-collapse:collapse;">
            <tr><td style="padding:10px 0;border-bottom:1px solid #f0f0f0;color:#6b6b6b;">Date</td><td style="padding:10px 0;border-bottom:1px solid #f0f0f0;font-weight:600;">${niceDate}</td></tr>
            <tr><td style="padding:10px 0;border-bottom:1px solid #f0f0f0;color:#6b6b6b;">Time</td><td style="padding:10px 0;border-bottom:1px solid #f0f0f0;font-weight:600;">${niceTime}</td></tr>
            <tr><td style="padding:10px 0;border-bottom:1px solid #f0f0f0;color:#6b6b6b;">Service</td><td style="padding:10px 0;border-bottom:1px solid #f0f0f0;font-weight:600;">${serviceName}</td></tr>
          </table>
          <p style="margin-top:16px;font-size:0.9em;color:#6b6b6b;">Need to reschedule? Contact us at ${BUSINESS_EMAIL} or ${BUSINESS_PHONE}</p>
        </div>
      </div>`,
    });
    console.log(`✅ Reminder sent to ${customerEmail}`);
    return true;
  } catch (err) {
    console.error(`❌ Reminder email error: ${err.message}`);
    return false;
  }
}

// ─── Utilities ───────────────────────────────────────────
function formatTimeNice(t) {
  const [h, m] = t.split(":").map(Number);
  const ampm = h >= 12 ? "PM" : "AM";
  const h12 = h % 12 || 12;
  return `${h12}:${String(m).padStart(2, "0")} ${ampm}`;
}

function formatDateNice(d) {
  try {
    const dt = new Date(d + "T12:00:00");
    return dt.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric" });
  } catch {
    return d;
  }
}

function corsHeaders() {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
  };
}

module.exports = {
  BUSINESS_NAME, BUSINESS_EMAIL, BUSINESS_PHONE, REMINDER_HOURS_BEFORE,
  SERVICES, BUSINESS_HOURS,
  getNextId, getAppointments, saveAppointments, getCustomers, saveCustomers,
  sendConfirmationEmail, sendReminderEmail,
  formatTimeNice, formatDateNice, corsHeaders,
};
