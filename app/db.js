import dotenv from 'dotenv';
import pkg from 'pg';

dotenv.config();

console.log('DATABASE_URL exists:', !!process.env.DATABASE_URL);

const { Pool } = pkg;

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

export default pool;