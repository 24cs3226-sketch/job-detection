# 🛡️ JobShield — Fake Job & Internship Detection System

Final Year Project: A full-stack web application that detects fake job/internship
postings using a **rule-based detection engine**. Supports both **pasted text**
and **uploaded screenshots** (via OCR), and cross-checks company names against
a safety registry (trusted / blacklisted companies).

---

## 🧰 Tech Stack

| Layer        | Technology                         |
|--------------|-------------------------------------|
| Frontend     | HTML5, CSS3, Vanilla JavaScript     |
| Backend      | Node.js + Express.js                |
| Database     | MySQL                               |
| OCR Engine   | Tesseract.js                        |
| File Upload  | Multer                              |

---

## 📁 Project Structure

```
fake-job-detector/
├── backend/
│   ├── config/
│   │   ├── db.js                 # MySQL connection pool
│   │   └── multerConfig.js       # Image upload config
│   ├── routes/
│   │   └── scanRoutes.js         # All API endpoints
│   ├── utils/
│   │   ├── detectionEngine.js    # Core rule-based detection logic
│   │   └── ocrEngine.js          # Tesseract OCR wrapper
│   ├── uploads/                  # Uploaded screenshots stored here
│   ├── .env                      # DB credentials (EDIT THIS)
│   ├── package.json
│   └── server.js                 # Entry point
├── frontend/
│   ├── css/style.css
│   ├── js/
│   │   ├── main.js               # Scanner page logic
│   │   ├── history.js            # History page logic
│   │   └── companies.js          # Company registry page logic
│   ├── index.html                # Scanner (main page)
│   ├── history.html              # Scan history / audit trail
│   └── companies.html            # Company safety registry
└── database/
    └── schema.sql                # Run this first to set up MySQL
```

---

## ⚙️ Setup Instructions (Step by Step)

### 1. Prerequisites
Install these if you don't have them already:
- **Node.js** (v16 or higher) — https://nodejs.org
- **MySQL** (v8 recommended) — https://dev.mysql.com/downloads/

### 2. Set up the Database
Open MySQL command line or MySQL Workbench, then run:

```bash
mysql -u root -p < database/schema.sql
```

This creates the `fake_job_detector` database with 3 tables:
- `scan_history` — logs every scan performed
- `known_companies` — trusted/blacklisted company registry (pre-seeded with 10 companies)
- `red_flag_keywords` — keyword list that powers detection (pre-seeded with 30+ keywords)

### 3. Configure Backend Environment
Open `backend/.env` and update with your MySQL password:

```
PORT=5000
DB_HOST=localhost
DB_USER=root
DB_PASSWORD=your_mysql_password_here
DB_NAME=fake_job_detector
```

### 4. Install Backend Dependencies

```bash
cd backend
npm install
```

This installs: express, mysql2, multer, tesseract.js, cors, dotenv, body-parser.

> ⏳ Note: `tesseract.js` downloads its OCR language model on first use — make
> sure you have an internet connection the first time you scan an image.

### 5. Run the Server

```bash
npm start
```

You should see:
```
✅ MySQL Database connected successfully!
🚀 Server running at http://localhost:5000
```

### 6. Open the App
Go to **http://localhost:5000** in your browser. That's it — frontend and
backend are served from the same Express server, no separate frontend setup needed.

---

## 🧠 How the Detection Engine Works

The core logic lives in `backend/utils/detectionEngine.js`. It scores every
post from **0 to 100** using four layers:

1. **Keyword matching** — checks text against `red_flag_keywords` table
   (e.g. "registration fee", "send money", "urgent hiring")
2. **Pattern matching (regex)** — catches structural red flags like:
   - Requests for payment/deposit
   - Personal Gmail/Yahoo addresses used for "official" hiring
   - Shortened links (bit.ly, tinyurl)
   - Requests for Aadhar/bank/OTP details
   - "No interview" / "100% guaranteed" claims
3. **Company safety cross-check** — looks up the company name against
   `known_companies`:
   - Trusted company mentioned → score **decreases**
   - Blacklisted company mentioned → score **increases sharply** (auto-FAKE)
   - Unknown company → small risk added (can't be verified)
4. **Structure check** — very short, vague posts get a small penalty

**Verdict thresholds:**
| Score    | Verdict       |
|----------|---------------|
| 0–24     | ✅ REAL        |
| 25–49    | ⚠️ SUSPICIOUS  |
| 50–100   | 🛑 FAKE        |

For image uploads, **Tesseract.js OCR** extracts the text first, then the
exact same scoring engine runs on the extracted text — so detection logic
is shared between both input types (single source of truth).

---

## 🔌 API Endpoints

| Method | Endpoint            | Description                          |
|--------|----------------------|---------------------------------------|
| POST   | `/api/scan/text`     | Analyze pasted job text               |
| POST   | `/api/scan/image`    | Upload image → OCR → analyze          |
| GET    | `/api/history`       | Get scan history (latest first)       |
| GET    | `/api/history/:id`   | Get full detail of one scan           |
| GET    | `/api/companies`     | List all known companies              |
| POST   | `/api/companies`     | Add/update a company in the registry  |
| GET    | `/api/stats`         | Dashboard stats (counts by verdict)   |

---

## 🎓 Ideas to Extend (for viva / demo / future scope)

- Add user accounts & login (so each student has their own scan history)
- Add a browser extension that scans job posts directly on LinkedIn/Naukri
- Replace/augment the rule-based engine with a trained ML model (e.g. Naive
  Bayes / Logistic Regression on a labeled dataset) — your detection engine
  is already structured so this can plug in alongside the rules
- Add email/SMS alerts when a scan returns FAKE
- Add admin login for managing the keyword & company lists from the UI
- Auto-fetch and verify company domains using a live WHOIS/DNS check

---

## ⚠️ Disclaimer (good to mention in your report/viva)

This is a **rule-based heuristic system**, not a guarantee. It is built to
assist users in spotting common scam patterns — it cannot catch every fake
post, and a "REAL" verdict doesn't replace independent verification (e.g.
checking the company's official careers page). This should be stated clearly
in your project report's limitations section.
