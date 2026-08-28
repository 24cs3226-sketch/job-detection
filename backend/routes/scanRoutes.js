// ============================================
// API Routes
// ============================================
const express = require('express');
const router = express.Router();
const pool = require('../config/db');
const upload = require('../config/multerConfig');
const { analyzeJobText } = require('../utils/detectionEngine');
const { extractTextFromImage } = require('../utils/ocrEngine');
const fs = require('fs');
const path = require('path');

// ------------------------------------------------
// POST /api/scan/text
// Analyze a pasted job/internship description
// ------------------------------------------------
router.post('/scan/text', async (req, res) => {
    try {
        const { jobText } = req.body;

        if (!jobText || jobText.trim().length === 0) {
            return res.status(400).json({ success: false, message: 'Job text is required.' });
        }

        const result = await analyzeJobText(jobText);

        // Save scan to history
        const ip = req.ip || req.connection.remoteAddress;
        await pool.query(
            `INSERT INTO scan_history (input_type, original_text, company_name, risk_score, verdict, matched_flags, ip_address)
             VALUES (?, ?, ?, ?, ?, ?, ?)`,
            [
                'text',
                jobText,
                result.company_check.company_name || result.company_guess || null,
                result.risk_score,
                result.verdict,
                JSON.stringify(result.matched_flags),
                ip
            ]
        );

        res.json({ success: true, data: result });
    } catch (err) {
        console.error('Error in /scan/text:', err);
        res.status(500).json({ success: false, message: 'Server error while analyzing text.' });
    }
});

// ------------------------------------------------
// POST /api/scan/image
// Upload a screenshot, OCR it, then analyze the text
// ------------------------------------------------
router.post('/scan/image', upload.single('jobImage'), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ success: false, message: 'No image uploaded.' });
        }

        const imagePath = req.file.path;

        // 1. Extract text using OCR
        const extractedText = await extractTextFromImage(imagePath);

        if (!extractedText || extractedText.trim().length === 0) {
            return res.status(400).json({
                success: false,
                message: 'Could not read any text from this image. Try a clearer screenshot.'
            });
        }

        // 2. Run the same detection logic on extracted text
        const result = await analyzeJobText(extractedText);

        // 3. Save to history
        const ip = req.ip || req.connection.remoteAddress;
        await pool.query(
            `INSERT INTO scan_history (input_type, original_text, company_name, risk_score, verdict, matched_flags, image_path, ip_address)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
            [
                'image',
                extractedText,
                result.company_check.company_name || result.company_guess || null,
                result.risk_score,
                result.verdict,
                JSON.stringify(result.matched_flags),
                req.file.filename,
                ip
            ]
        );

        res.json({
            success: true,
            data: {
                ...result,
                extracted_text: extractedText
            }
        });
    } catch (err) {
        console.error('Error in /scan/image:', err);
        res.status(500).json({ success: false, message: err.message || 'Server error while analyzing image.' });
    }
});

// ------------------------------------------------
// GET /api/history
// Get past scan history (latest first)
// ------------------------------------------------
router.get('/history', async (req, res) => {
    try {
        const limit = parseInt(req.query.limit) || 50;
        const [rows] = await pool.query(
            `SELECT id, input_type, LEFT(original_text, 150) AS preview, company_name,
                    risk_score, verdict, created_at
             FROM scan_history
             ORDER BY created_at DESC
             LIMIT ?`,
            [limit]
        );
        res.json({ success: true, data: rows });
    } catch (err) {
        console.error('Error in /history:', err);
        res.status(500).json({ success: false, message: 'Server error while fetching history.' });
    }
});

// ------------------------------------------------
// GET /api/history/:id
// Get full detail of one past scan
// ------------------------------------------------
router.get('/history/:id', async (req, res) => {
    try {
        const [rows] = await pool.query('SELECT * FROM scan_history WHERE id = ?', [req.params.id]);
        if (rows.length === 0) {
            return res.status(404).json({ success: false, message: 'Scan not found.' });
        }
        res.json({ success: true, data: rows[0] });
    } catch (err) {
        console.error('Error in /history/:id:', err);
        res.status(500).json({ success: false, message: 'Server error.' });
    }
});

// ------------------------------------------------
// DELETE /api/history/:id
// Remove one scan from history — deletes the DB row
// and, if the scan was an image upload, deletes the
// stored screenshot file too. The risk score / verdict
// live on the same row, so they're removed with it.
// ------------------------------------------------
router.delete('/history/:id', async (req, res) => {
    try {
        const { id } = req.params;

        const [rows] = await pool.query(
            'SELECT image_path FROM scan_history WHERE id = ?',
            [id]
        );

        if (rows.length === 0) {
            return res.status(404).json({ success: false, message: 'Scan not found.' });
        }

        const imagePath = rows[0].image_path;

        const [result] = await pool.query('DELETE FROM scan_history WHERE id = ?', [id]);

        if (result.affectedRows === 0) {
            return res.status(404).json({ success: false, message: 'Scan not found.' });
        }

        // Clean up the stored screenshot, if this scan had one
        if (imagePath) {
            const fullPath = path.join(__dirname, '..', 'uploads', imagePath);
            fs.unlink(fullPath, (err) => {
                if (err && err.code !== 'ENOENT') {
                    console.error('Could not delete image file:', fullPath, err.message);
                }
            });
        }

        res.json({ success: true, message: 'Scan deleted.' });
    } catch (err) {
        console.error('Error in DELETE /history/:id:', err);
        res.status(500).json({ success: false, message: 'Server error while deleting scan.' });
    }
});

// ------------------------------------------------
// GET /api/companies
// Get the list of known companies (trusted/blacklisted)
// ------------------------------------------------
router.get('/companies', async (req, res) => {
    try {
        const [rows] = await pool.query('SELECT * FROM known_companies ORDER BY status, company_name');
        res.json({ success: true, data: rows });
    } catch (err) {
        console.error('Error in /companies:', err);
        res.status(500).json({ success: false, message: 'Server error while fetching companies.' });
    }
});

// ------------------------------------------------
// GET /api/stats
// Dashboard stats - totals by verdict
// ------------------------------------------------
router.get('/stats', async (req, res) => {
    try {
        const [totals] = await pool.query(
            `SELECT verdict, COUNT(*) AS count FROM scan_history GROUP BY verdict`
        );
        const [totalScans] = await pool.query(`SELECT COUNT(*) AS total FROM scan_history`);
        res.json({
            success: true,
            data: {
                total: totalScans[0].total,
                breakdown: totals
            }
        });
    } catch (err) {
        console.error('Error in /stats:', err);
        res.status(500).json({ success: false, message: 'Server error while fetching stats.' });
    }
});

module.exports = router;
