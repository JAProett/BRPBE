import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import reportsRouter from './routes/reports.js';
import cron from 'node-cron';
import pool from './db.js';

dotenv.config();

const app = express();

app.use(cors());
app.use(express.json());

app.get('/', (req, res) => {
  res.send('BRP Reports API running');
});

// routes
app.use('/api/reports', reportsRouter);

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

cron.schedule('0 3 * * *', async () => {
  console.log('Running cleanup job...');

  try {
    const result = await pool.query(`
      DELETE FROM road_reports
      WHERE created_at < NOW() - INTERVAL '3 days'
    `);

    console.log(`Deleted ${result.rowCount} old reports`);
  } catch (err) {
    console.error('Cleanup job failed:', err);
  }
});