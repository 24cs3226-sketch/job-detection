// ============================================
// Database Connection (MySQL)
// ============================================
require('dotenv').config();
const mysql = require('mysql2/promise');

// Connection pool - reuses connections, better performance
const pool = mysql.createPool({
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'fake_job_detector',
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0
});

// Test connection on startup
async function testConnection() {
    try {
        const connection = await pool.getConnection();
        console.log('✅ MySQL Database connected successfully!');
        connection.release();
    } catch (err) {
        console.error('❌ Database connection failed:', err.message);
        console.error('   Check your .env file and make sure MySQL is running.');
    }
}

testConnection();

module.exports = pool;
