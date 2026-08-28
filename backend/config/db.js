const mysql = require("mysql2/promise");

const db = mysql.createPool({
  host: process.env.DB_HOST,
  port: Number(process.env.DB_PORT),
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,

  ssl: {
    rejectUnauthorized: false
  },

  connectTimeout: 30000
});

db.getConnection()
  .then(connection => {
    console.log("✅ MySQL Database connected successfully!");
    connection.release();
  })
  .catch(err => {
    console.error(
      "❌ Database connection failed:",
      err.code,
      err.message
    );
  });

module.exports = db;