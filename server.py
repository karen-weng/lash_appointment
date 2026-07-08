#!/usr/bin/env python3
"""
Lash Business Appointment Booking Server
Uses only Python standard library — no external dependencies.
"""

import json
import sqlite3
import os
import threading
import time
import smtplib
from email.message import EmailMessage
from http.server import HTTPServer, BaseHTTPRequestHandler
from urllib.parse import urlparse, parse_qs
from datetime import datetime, timedelta

DB_PATH = os.path.join(os.path.dirname(os.path.abspath(__file__)), "lash_bookings.db")

# ─── Reminder Configuration ───────────────────────────────────────────
REMINDER_HOURS_BEFORE = 1        # Send reminder N hours before appointment
REMINDER_CHECK_INTERVAL = 60     # Check every 5 minutes
SMTP_HOST = "smtp.gmail.com"      # Change for your email provider
SMTP_PORT = 587
SMTP_USER = "kiosk.wing@gmail.com"                    # Set your email address
SMTP_PASS = "fepp ttfz ulug wyxe"                    # Set your app password
BUSINESS_NAME = "Luxe Lashes"
BUSINESS_EMAIL = "hello@luxelashes.com"
BUSINESS_PHONE = "(555) 123-4567"

# ─── Database Setup ────────────────────────────────────────────────────
def init_db():
    conn = sqlite3.connect(DB_PATH)
    c = conn.cursor()

    c.execute("""
        CREATE TABLE IF NOT EXISTS services (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            description TEXT,
            duration_minutes INTEGER NOT NULL,
            price REAL NOT NULL,
            category TEXT NOT NULL,
            is_popular INTEGER DEFAULT 0
        )
    """)

    c.execute("""
        CREATE TABLE IF NOT EXISTS customers (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            first_name TEXT NOT NULL,
            last_name TEXT NOT NULL,
            email TEXT NOT NULL,
            phone TEXT NOT NULL,
            created_at TEXT DEFAULT (datetime('now'))
        )
    """)

    c.execute("""
        CREATE TABLE IF NOT EXISTS appointments (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            customer_id INTEGER NOT NULL,
            service_id INTEGER NOT NULL,
            appointment_date TEXT NOT NULL,
            appointment_time TEXT NOT NULL,
            status TEXT DEFAULT 'confirmed',
            notes TEXT,
            created_at TEXT DEFAULT (datetime('now')),
            confirmation_sent INTEGER DEFAULT 0,
            reminder_sent INTEGER DEFAULT 0,
            FOREIGN KEY (customer_id) REFERENCES customers(id),
            FOREIGN KEY (service_id) REFERENCES services(id)
        )
    """)

    c.execute("""
        CREATE TABLE IF NOT EXISTS business_hours (
            day_of_week INTEGER NOT NULL,
            open_time TEXT NOT NULL,
            close_time TEXT NOT NULL,
            is_open INTEGER DEFAULT 1
        )
    """)

    # Seed services if empty
    c.execute("SELECT COUNT(*) FROM services")
    if c.fetchone()[0] == 0:
        services = [
            # Classic Lashes
            ("Classic Full Set", "Natural-looking one-on-one lash extension application", 120, 150.00, "Classic", 1),
            ("Classic Refill", "Touch-up for classic lash set (2-3 weeks)", 60, 65.00, "Classic", 0),
            ("Classic Mega Full Set", "Dramatic classic set with maximum density", 150, 185.00, "Classic", 0),

            # Volume Lashes
            ("Volume Full Set", "Handmade volume fans for a fluffy, dramatic look", 150, 200.00, "Volume", 1),
            ("Volume Refill", "Touch-up for volume lash set (2-3 weeks)", 75, 85.00, "Volume", 0),
            ("Mega Volume Full Set", "Ultra-dramatic mega volume lash application", 180, 250.00, "Volume", 0),
            ("Mega Volume Refill", "Touch-up for mega volume set", 90, 100.00, "Volume", 0),

            # Hybrid Lashes
            ("Hybrid Full Set", "Mix of classic & volume for textured look", 135, 175.00, "Hybrid", 1),
            ("Hybrid Refill", "Touch-up for hybrid lash set", 70, 75.00, "Hybrid", 0),

            # Wispy / Cat Eye
            ("Wispy Cat Eye Full Set", "Elongated outer corners for a cat-eye effect", 140, 190.00, "Wispy", 0),
            ("Wispy Refill", "Touch-up for wispy lash set", 75, 80.00, "Wispy", 0),

            # Lash Lift & Tint
            ("Lash Lift", "Natural lash perm for a lifted, curled look", 60, 75.00, "Lash Lift", 1),
            ("Lash Lift & Tint", "Lash lift plus tinting for darker, defined lashes", 75, 95.00, "Lash Lift", 0),
            ("Lash Tint Only", "Professional tinting for natural lashes", 30, 35.00, "Lash Lift", 0),

            # Removal / Add-ons
            ("Lash Removal", "Safe removal of existing lash extensions", 30, 30.00, "Other", 0),
            ("Lash Bath Add-on", "Deep cleanse & conditioning treatment", 15, 20.00, "Other", 0),
        ]
        c.executemany(
            "INSERT INTO services (name, description, duration_minutes, price, category, is_popular) VALUES (?,?,?,?,?,?)",
            services,
        )

    # Seed business hours if empty
    c.execute("SELECT COUNT(*) FROM business_hours")
    if c.fetchone()[0] == 0:
        hours = [
            (0, "10:00", "17:00", 0),  # Sunday - closed
            (1, "09:00", "19:00", 1),  # Monday
            (2, "09:00", "19:00", 1),
            (3, "09:00", "19:00", 1),
            (4, "09:00", "19:00", 1),
            (5, "09:00", "19:00", 1),
            (6, "09:00", "17:00", 1),  # Saturday
        ]
        c.executemany(
            "INSERT INTO business_hours (day_of_week, open_time, close_time, is_open) VALUES (?,?,?,?)",
            hours,
        )

    conn.commit()
    conn.close()


def get_db():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn


# ─── Email Reminder ────────────────────────────────────────────────────
def send_reminder_email(customer_email, customer_name, service_name, appt_date, appt_time):
    """Send appointment reminder email. Configure SMTP settings above."""
    if not SMTP_USER or not SMTP_PASS:
        print(f"  📧 [REMINDER] Would send to {customer_email}: "
              f"Hi {customer_name}, reminder for {service_name} on {appt_date} at {appt_time}")
        return True

    try:
        msg = EmailMessage()
        msg["Subject"] = f"⏰ Appointment Reminder — {BUSINESS_NAME}"
        msg["From"] = SMTP_USER
        msg["To"] = customer_email

        # Format date nicely
        try:
            dt = datetime.strptime(appt_date, "%Y-%m-%d")
            nice_date = dt.strftime("%A, %B %d, %Y")
        except:
            nice_date = appt_date

        # Format time nicely
        try:
            h, m = map(int, appt_time.split(":"))
            ampm = "AM" if h < 12 else "PM"
            h12 = h % 12 or 12
            nice_time = f"{h12}:{m:02d} {ampm}"
        except:
            nice_time = appt_time

        msg.set_content(
            f"Hi {customer_name},\n\n"
            f"⏰ This is a reminder that your appointment is in 1 HOUR!\n\n"
            f"  📅 Date: {nice_date}\n"
            f"  🕐 Time: {nice_time}\n"
            f"  💅 Service: {service_name}\n\n"
            f"If you need to reschedule, please contact us:\n"
            f"  📧 {BUSINESS_EMAIL}\n"
            f"  📞 {BUSINESS_PHONE}\n\n"
            f"We look forward to seeing you!\n\n"
            f"— {BUSINESS_NAME}"
        )

        # HTML version
        msg.add_alternative(
            f"""<div style="font-family:Arial,sans-serif;max-width:500px;margin:0 auto;color:#2d2d2d;">
              <div style="background:linear-gradient(135deg,#a06560,#c4837f);padding:30px;border-radius:12px 12px 0 0;text-align:center;">
                <h1 style="color:white;margin:0;font-size:1.5em;">⏰ {BUSINESS_NAME}</h1>
                <p style="color:rgba(255,255,255,0.9);margin:8px 0 0;">Appointment Reminder</p>
              </div>
              <div style="background:white;padding:28px;border-radius:0 0 12px 12px;border:1px solid #e8e4e1;">
                <p>Hi {customer_name},</p>
                <p style="font-size:1.1em;font-weight:600;">Your appointment is in 1 HOUR!</p>
                <table style="width:100%;border-collapse:collapse;">
                  <tr><td style="padding:10px 0;border-bottom:1px solid #f0f0f0;color:#6b6b6b;">Date</td><td style="padding:10px 0;border-bottom:1px solid #f0f0f0;font-weight:600;">{nice_date}</td></tr>
                  <tr><td style="padding:10px 0;border-bottom:1px solid #f0f0f0;color:#6b6b6b;">Time</td><td style="padding:10px 0;border-bottom:1px solid #f0f0f0;font-weight:600;">{nice_time}</td></tr>
                  <tr><td style="padding:10px 0;border-bottom:1px solid #f0f0f0;color:#6b6b6b;">Service</td><td style="padding:10px 0;border-bottom:1px solid #f0f0f0;font-weight:600;">{service_name}</td></tr>
                </table>
                <p style="margin-top:16px;font-size:0.9em;color:#6b6b6b;">Need to reschedule? Contact us at {BUSINESS_EMAIL} or {BUSINESS_PHONE}</p>
              </div>
            </div>""",
            subtype="html"
        )

        with smtplib.SMTP(SMTP_HOST, SMTP_PORT) as server:
            server.starttls()
            server.login(SMTP_USER, SMTP_PASS)
            server.send_message(msg)

        print(f"  ✅ Reminder sent to {customer_email}")
        return True
    except Exception as e:
        print(f"  ❌ Email error: {e}")
        return False




def send_confirmation_email(customer_email, customer_name, service_name, appt_date, appt_time, price, duration, appt_id):
    """Send booking confirmation email immediately after booking."""
    if not SMTP_USER or not SMTP_PASS:
        print(f"  📧 [CONFIRMATION] Would send to {customer_email}: "
              f"Hi {customer_name}, booking confirmed for {service_name} on {appt_date} at {appt_time}")
        return True

    try:
        msg = EmailMessage()
        msg["Subject"] = f"✅ Booking Confirmed — {BUSINESS_NAME}"
        msg["From"] = SMTP_USER
        msg["To"] = customer_email

        # Format date nicely
        try:
            dt = datetime.strptime(appt_date, "%Y-%m-%d")
            nice_date = dt.strftime("%A, %B %d, %Y")
        except:
            nice_date = appt_date

        # Format time nicely
        try:
            h, m = map(int, appt_time.split(":"))
            ampm = "AM" if h < 12 else "PM"
            h12 = h % 12 or 12
            nice_time = f"{h12}:{m:02d} {ampm}"
        except:
            nice_time = appt_time

        msg.set_content(
            f"Hi {customer_name},\n\n"
            f"Your appointment has been confirmed! Here are the details:\n\n"
            f"  📋 Confirmation #: {appt_id}\n"
            f"  📅 Date: {nice_date}\n"
            f"  🕐 Time: {nice_time}\n"
            f"  💅 Service: {service_name}\n"
            f"  ⏱ Duration: {duration} minutes\n"
            f"  💰 Price: ${price:.2f}\n\n"
            f"You will receive a reminder 1 hour before your appointment.\n\n"
            f"If you need to reschedule or cancel, please contact us:\n"
            f"  📧 {BUSINESS_EMAIL}\n"
            f"  📞 {BUSINESS_PHONE}\n\n"
            f"See you soon!\n\n"
            f"— {BUSINESS_NAME}"
        )

        # HTML version for prettier display
        msg.add_alternative(
            f"""<div style="font-family:Arial,sans-serif;max-width:500px;margin:0 auto;color:#2d2d2d;">
              <div style="background:linear-gradient(135deg,#a06560,#c4837f);padding:30px;border-radius:12px 12px 0 0;text-align:center;">
                <h1 style="color:white;margin:0;font-size:1.5em;">{BUSINESS_NAME}</h1>
                <p style="color:rgba(255,255,255,0.9);margin:8px 0 0;">Booking Confirmed!</p>
              </div>
              <div style="background:white;padding:28px;border-radius:0 0 12px 12px;border:1px solid #e8e4e1;">
                <p>Hi {customer_name},</p>
                <p>Your appointment has been confirmed! Here are the details:</p>
                <table style="width:100%;border-collapse:collapse;">
                  <tr><td style="padding:10px 0;border-bottom:1px solid #f0f0f0;color:#6b6b6b;">Confirmation #</td><td style="padding:10px 0;border-bottom:1px solid #f0f0f0;font-weight:600;">{appt_id}</td></tr>
                  <tr><td style="padding:10px 0;border-bottom:1px solid #f0f0f0;color:#6b6b6b;">Date</td><td style="padding:10px 0;border-bottom:1px solid #f0f0f0;font-weight:600;">{nice_date}</td></tr>
                  <tr><td style="padding:10px 0;border-bottom:1px solid #f0f0f0;color:#6b6b6b;">Time</td><td style="padding:10px 0;border-bottom:1px solid #f0f0f0;font-weight:600;">{nice_time}</td></tr>
                  <tr><td style="padding:10px 0;border-bottom:1px solid #f0f0f0;color:#6b6b6b;">Service</td><td style="padding:10px 0;border-bottom:1px solid #f0f0f0;font-weight:600;">{service_name}</td></tr>
                  <tr><td style="padding:10px 0;border-bottom:1px solid #f0f0f0;color:#6b6b6b;">Duration</td><td style="padding:10px 0;border-bottom:1px solid #f0f0f0;font-weight:600;">{duration} minutes</td></tr>
                  <tr><td style="padding:10px 0;border-bottom:1px solid #f0f0f0;color:#6b6b6b;">Price</td><td style="padding:10px 0;border-bottom:1px solid #f0f0f0;font-weight:600;color:#a06560;font-size:1.1em;">${price:.2f}</td></tr>
                </table>
                <p style="margin-top:20px;padding:14px;background:#f5e6e4;border-radius:8px;font-size:0.9em;">⏰ You will receive a reminder 1 hour before your appointment.</p>
                <p style="margin-top:16px;font-size:0.9em;color:#6b6b6b;">Need to reschedule? Contact us at {BUSINESS_EMAIL} or {BUSINESS_PHONE}</p>
              </div>
            </div>""",
            subtype="html"
        )

        with smtplib.SMTP(SMTP_HOST, SMTP_PORT) as server:
            server.starttls()
            server.login(SMTP_USER, SMTP_PASS)
            server.send_message(msg)

        print(f"  ✅ Confirmation sent to {customer_email}")
        return True
    except Exception as e:
        print(f"  ❌ Confirmation email error: {e}")
        return False

def reminder_worker():
    """Background thread that sends reminders for upcoming appointments."""
    print("🔔 Reminder worker started")
    while True:
        try:
            conn = get_db()
            now = datetime.now()
            cutoff = now + timedelta(hours=REMINDER_HOURS_BEFORE)

            rows = conn.execute("""
                SELECT a.id, a.appointment_date, a.appointment_time,
                       c.first_name, c.last_name, c.email,
                       s.name as service_name
                FROM appointments a
                JOIN customers c ON a.customer_id = c.id
                JOIN services s ON a.service_id = s.id
                WHERE a.status = 'confirmed'
                  AND a.reminder_sent = 0
            """).fetchall()

            for row in rows:
                appt_dt = datetime.strptime(f"{row['appointment_date']} {row['appointment_time']}", "%Y-%m-%d %H:%M")
                if now <= appt_dt <= cutoff:
                    name = f"{row['first_name']} {row['last_name']}"
                    success = send_reminder_email(
                        row["email"], name, row["service_name"],
                        row["appointment_date"], row["appointment_time"],
                    )
                    if success:
                        conn.execute("UPDATE appointments SET reminder_sent = 1 WHERE id = ?", (row["id"],))
                        conn.commit()

            conn.close()
        except Exception as e:
            print(f"⚠️ Reminder worker error: {e}")

        time.sleep(REMINDER_CHECK_INTERVAL)


# ─── API Handler ────────────────────────────────────────────────────────
class BookingHandler(BaseHTTPRequestHandler):
    def log_message(self, fmt, *args):
        print(f"  🌐 {args[0]}")

    def _send_json(self, data, status=200):
        body = json.dumps(data, default=str).encode()
        self.send_response(status)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", len(body))
        self.end_headers()
        self.wfile.write(body)

    def _send_file(self, filepath, content_type):
        with open(filepath, "rb") as f:
            body = f.read()
        self.send_response(200)
        self.send_header("Content-Type", content_type)
        self.send_header("Content-Length", len(body))
        self.end_headers()
        self.wfile.write(body)

    def _read_body(self):
        length = int(self.headers.get("Content-Length", 0))
        return json.loads(self.rfile.read(length)) if length else {}

    # ── GET Routes ──────────────────────────────────────────────────────
    def do_GET(self):
        parsed = urlparse(self.path)
        path = parsed.path
        qs = parse_qs(parsed.query)

        # Static files
        if path == "/" or path == "/index.html":
            return self._send_file(
                os.path.join(os.path.dirname(__file__), "static", "index.html"), "text/html"
            )
        if path.startswith("/static/"):
            filepath = os.path.join(os.path.dirname(__file__), path.lstrip("/"))
            if os.path.isfile(filepath):
                ct = "text/css" if filepath.endswith(".css") else "application/javascript"
                return self._send_file(filepath, ct)

        # API: Get all services
        if path == "/api/services":
            conn = get_db()
            cat = qs.get("category", [None])[0]
            if cat:
                rows = conn.execute("SELECT * FROM services WHERE category = ? ORDER BY price", (cat,)).fetchall()
            else:
                rows = conn.execute("SELECT * FROM services ORDER BY category, price").fetchall()
            services = [dict(r) for r in rows]
            conn.close()
            return self._send_json({"services": services})

        # API: Get service categories
        if path == "/api/categories":
            conn = get_db()
            rows = conn.execute("SELECT DISTINCT category FROM services ORDER BY category").fetchall()
            cats = [r["category"] for r in rows]
            conn.close()
            return self._send_json({"categories": cats})

        # API: Get available time slots
        if path == "/api/availability":
            date = qs.get("date", [None])[0]
            service_id = qs.get("service_id", [None])[0]
            if not date or not service_id:
                return self._send_json({"error": "date and service_id required"}, 400)

            conn = get_db()
            service = conn.execute("SELECT * FROM services WHERE id = ?", (service_id,)).fetchone()
            if not service:
                conn.close()
                return self._send_json({"error": "Service not found"}, 404)

            day_of_week = datetime.strptime(date, "%Y-%m-%d").weekday()
            bh = conn.execute("SELECT * FROM business_hours WHERE day_of_week = ?", (day_of_week,)).fetchone()
            if not bh or not bh["is_open"]:
                conn.close()
                return self._send_json({"slots": [], "closed": True, "message": "We are closed on this day"})

            # Get booked slots
            booked = conn.execute(
                "SELECT appointment_time FROM appointments WHERE appointment_date = ? AND status = 'confirmed'",
                (date,),
            ).fetchall()
            booked_times = {r["appointment_time"] for r in booked}

            # Generate 30-min slots
            open_h, open_m = map(int, bh["open_time"].split(":"))
            close_h, close_m = map(int, bh["close_time"].split(":"))
            open_min = open_h * 60 + open_m
            close_min = close_h * 60 + close_m
            duration = service["duration_minutes"]
            last_start = close_min - duration

            slots = []
            for mins in range(open_min, last_start + 1, 30):
                t = f"{mins // 60:02d}:{mins % 60:02d}"
                slots.append({
                    "time": t,
                    "available": t not in booked_times,
                    "display": self._format_time(t),
                })

            conn.close()
            return self._send_json({"slots": slots, "closed": False})

        # API: Get appointments (admin)
        if path == "/api/appointments":
            conn = get_db()
            date = qs.get("date", [None])[0]
            if date:
                rows = conn.execute("""
                    SELECT a.*, c.first_name, c.last_name, c.email, c.phone,
                           s.name as service_name, s.duration_minutes, s.price
                    FROM appointments a
                    JOIN customers c ON a.customer_id = c.id
                    JOIN services s ON a.service_id = s.id
                    WHERE a.appointment_date = ?
                    ORDER BY a.appointment_time
                """, (date,)).fetchall()
            else:
                rows = conn.execute("""
                    SELECT a.*, c.first_name, c.last_name, c.email, c.phone,
                           s.name as service_name, s.duration_minutes, s.price
                    FROM appointments a
                    JOIN customers c ON a.customer_id = c.id
                    JOIN services s ON a.service_id = s.id
                    ORDER BY a.appointment_date DESC, a.appointment_time
                    LIMIT 100
                """).fetchall()
            appts = [dict(r) for r in rows]
            conn.close()
            return self._send_json({"appointments": appts})

        # API: Cancel appointment
        if path.startswith("/api/cancel/"):
            appt_id = path.split("/")[-1]
            conn = get_db()
            conn.execute("UPDATE appointments SET status = 'cancelled' WHERE id = ?", (appt_id,))
            conn.commit()
            conn.close()
            return self._send_json({"success": True})

        self._send_json({"error": "Not found"}, 404)

    # ── POST Routes ─────────────────────────────────────────────────────
    def do_POST(self):
        parsed = urlparse(self.path)
        path = parsed.path

        # API: Create booking
        if path == "/api/book":
            data = self._read_body()
            required = ["first_name", "last_name", "email", "phone", "service_id", "date", "time"]
            for field in required:
                if not data.get(field):
                    return self._send_json({"error": f"Missing field: {field}"}, 400)

            conn = get_db()

            # Check slot is still available
            existing = conn.execute(
                "SELECT id FROM appointments WHERE appointment_date = ? AND appointment_time = ? AND status = 'confirmed'",
                (data["date"], data["time"]),
            ).fetchone()
            if existing:
                conn.close()
                return self._send_json({"error": "This time slot is no longer available"}, 409)

            # Upsert customer (by email)
            cust = conn.execute("SELECT id FROM customers WHERE email = ?", (data["email"],)).fetchone()
            if cust:
                customer_id = cust["id"]
                conn.execute(
                    "UPDATE customers SET first_name=?, last_name=?, phone=? WHERE id=?",
                    (data["first_name"], data["last_name"], data["phone"], customer_id),
                )
            else:
                cur = conn.execute(
                    "INSERT INTO customers (first_name, last_name, email, phone) VALUES (?,?,?,?)",
                    (data["first_name"], data["last_name"], data["email"], data["phone"]),
                )
                customer_id = cur.lastrowid

            # Create appointment
            cur = conn.execute(
                "INSERT INTO appointments (customer_id, service_id, appointment_date, appointment_time, notes) VALUES (?,?,?,?,?)",
                (customer_id, data["service_id"], data["date"], data["time"], data.get("notes", "")),
            )
            appt_id = cur.lastrowid
            conn.commit()

            # Send confirmation email
            try:
                service_info = conn.execute("SELECT name, duration_minutes, price FROM services WHERE id = ?", (data["service_id"],)).fetchone()
                send_confirmation_email(
                    data["email"],
                    f"{data['first_name']} {data['last_name']}",
                    service_info["name"],
                    data["date"],
                    data["time"],
                    service_info["price"],
                    service_info["duration_minutes"],
                    appt_id,
                )
                conn.execute("UPDATE appointments SET confirmation_sent = 1 WHERE id = ?", (appt_id,))
                conn.commit()
            except Exception as e:
                print(f"  ⚠️ Confirmation email failed: {e}")

            # Fetch full appointment for confirmation
            appt = conn.execute("""
                SELECT a.*, c.first_name, c.last_name, c.email, c.phone,
                       s.name as service_name, s.duration_minutes, s.price
                FROM appointments a
                JOIN customers c ON a.customer_id = c.id
                JOIN services s ON a.service_id = s.id
                WHERE a.id = ?
            """, (appt_id,)).fetchone()
            conn.close()

            return self._send_json({"success": True, "appointment": dict(appt)}, 201)

        self._send_json({"error": "Not found"}, 404)

    @staticmethod
    def _format_time(t):
        h, m = map(int, t.split(":"))
        ampm = "AM" if h < 12 else "PM"
        h12 = h if h <= 12 else h - 12
        if h12 == 0:
            h12 = 12
        return f"{h12}:{m:02d} {ampm}"


# ─── Main ──────────────────────────────────────────────────────────────
if __name__ == "__main__":
    init_db()
    print("✅ Database initialized")

    # Start reminder worker in background
    t = threading.Thread(target=reminder_worker, daemon=True)
    t.start()

    port = int(os.environ.get("PORT", 5000))
    class ReusableHTTPServer(HTTPServer):
        allow_reuse_address = True

    # Try binding - some environments restrict 0.0.0.0
    host = "0.0.0.0"
    try:
        server = ReusableHTTPServer((host, port), BookingHandler)
    except PermissionError:
        host = "127.0.0.1"
        try:
            server = ReusableHTTPServer((host, port), BookingHandler)
        except PermissionError:
            host = "localhost"
            server = ReusableHTTPServer((host, port), BookingHandler)
    print(f"\n👁️‍🗨️  {BUSINESS_NAME} Booking Server")
    print(f"   📍 http://{host}:{port}")
    print(f"   📊 http://localhost:{port}/#admin")
    print(f"   🔔 Reminders: {REMINDER_HOURS_BEFORE}h before, checking every {REMINDER_CHECK_INTERVAL}s")
    print(f"   📧 Confirmation emails: Sent immediately on booking\n")
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\n👋 Server stopped")
        server.server_close()
