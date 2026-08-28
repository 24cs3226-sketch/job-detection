// ============================================
// OCR Engine - extracts text from uploaded image
// using Tesseract.js, so the same detection logic
// can run on screenshots of job/internship posts.
// ============================================
const Tesseract = require('tesseract.js');

/**
 * Extracts text from an image file using OCR.
 * @param {string} imagePath - path to the uploaded image on disk
 * @returns {Promise<string>} extracted text
 */
async function extractTextFromImage(imagePath) {
    try {
        const result = await Tesseract.recognize(imagePath, 'eng', {
            logger: () => {} // silence progress logs; set to console.log for debugging
        });
        return result.data.text || '';
    } catch (err) {
        console.error('OCR extraction failed:', err.message);
        throw new Error('Could not extract text from the image. Please try a clearer image.');
    }
}

module.exports = { extractTextFromImage };
