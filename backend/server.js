// ============================================
// Fake Job & Internship Detection System
// Main Server File
// ============================================
require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');

const scanRoutes = require('./routes/scanRoutes');

const app = express();
const PORT = process.env.PORT || 5000;

// ---------- Middleware ----------
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve uploaded images (so they can be viewed if needed)
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Serve the frontend (HTML/CSS/JS)
// index:false so express.static doesn't auto-serve index.html for '/' —
// the app should land on the login page first.
app.use(express.static(path.join(__dirname, '..', 'frontend'), { index: false }));

// ---------- API Routes ----------
app.use('/api', scanRoutes);

// ---------- Root: send login.html first ----------
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, '..', 'frontend', 'login.html'));
});

// ---------- 404 handler for unknown API routes ----------
app.use('/api', (req, res) => {
    res.status(404).json({ success: false, message: 'API route not found.' });
});

// ---------- Global error handler ----------
app.use((err, req, res, next) => {
    console.error('Unhandled error:', err);
    res.status(500).json({ success: false, message: 'Something went wrong on the server.' });
});

app.listen(PORT, () => {
    console.log(`🚀 Server running at http://localhost:${PORT}`);
});
