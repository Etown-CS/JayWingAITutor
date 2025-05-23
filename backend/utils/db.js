const { Pool } = require('pg');
require('dotenv').config({ path: '../.env' });

const pool = new Pool({
  host: process.env.DB_HOST,
  database: process.env.DB_NAME,
  user: process.env.DB_USER,
  password: process.env.DB_PASS,
  port: 5432,
});

module.exports = pool;
