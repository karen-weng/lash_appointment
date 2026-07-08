# 💄 Luxe Lashes — Appointment Booking

A lash business appointment booking website with service selection, time slot booking, pricing, customer info storage, confirmation emails, and 1-hour appointment reminders.

## 🚀 Deploy to Vercel

### Step 1: Install Vercel CLI
```bash
npm install -g vercel
```

### Step 2: Install dependencies
```bash
cd ~/Documents/appointment
npm install
```

### Step 3: Set up Vercel KV (database)
1. Go to [vercel.com/dashboard](https://vercel.com/dashboard)
2. Create a new project or import this repo
3. Go to **Storage** tab → Create a **KV** store
4. Link it to your project

### Step 4: Set environment variables
In your Vercel project settings → Environment Variables, add:

| Variable | Value |
|----------|-------|
| `SMTP_HOST` | `smtp.gmail.com` |
| `SMTP_PORT` | `587` |
| `SMTP_USER` | Your Gmail address |
| `SMTP_PASS` | Your Gmail App Password |
| `CRON_SECRET` | Any random string (e.g. `my-secret-123`) |

### Step 5: Deploy
```bash
vercel --prod
```

Your site will be live at `https://your-project.vercel.app` 🎉

---

## 🖥️ Run Locally (Python version)

The original Python server is also included for local development:

```bash
python3 server.py
# Then open http://localhost:5000
```

---

## ✨ Features

- **Service Selection** — 16 lash services across 6 categories
- **Category Filtering** — Filter by Classic, Volume, Hybrid, Wispy, Lash Lift, Other
- **Interactive Calendar** — Pick a date, see available time slots
- **Real-time Availability** — Booked slots shown as unavailable
- **Customer Info** — Name, email, phone saved to database
- **Confirmation Email** — Sent immediately on booking (styled HTML)
- **1-Hour Reminder** — Cron job sends reminder 1 hour before appointment
- **Admin Dashboard** — View/cancel all appointments
- **Vercel KV Database** — Persistent serverless storage

---

## 📁 Project Structure

```
appointment/
├── api/                    ← Vercel serverless functions
│   ├── _lib.js             ← Shared logic (DB, email, seed data)
│   ├── services.js         ← GET /api/services
│   ├── categories.js       ← GET /api/categories
│   ├── availability.js     ← GET /api/availability
│   ├── book.js             ← POST /api/book
│   ├── appointments.js     ← GET /api/appointments
│   ├── cancel.js           ← GET /api/cancel
│   └── cron/
│       └── reminders.js    ← Cron: send reminder emails
├── public/
│   └── index.html          ← Frontend (single-page app)
├── server.py               ← Local Python server (alternative)
├── vercel.json             ← Vercel config + cron schedule
├── package.json            ← Node.js dependencies
└── .gitignore
```
