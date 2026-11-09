const mysql = require('mysql2/promise');

const pool = mysql.createPool({
  host: process.env.DB_HOST || 'localhost',
  port: Number(process.env.DB_PORT || 3306),
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'almacen_lab',
  waitForConnections: true,
  connectionLimit: 10,
  dateStrings: true, // DATE / DATETIME como texto, sin conversiones de zona horaria
  charset: 'utf8mb4',
});

module.exports = pool;
