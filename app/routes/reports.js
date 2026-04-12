import express from 'express';
import {
  submitReport,
  getSummary
} from '../services/reportService.js';

const router = express.Router();

// GET summary for a segment
router.get('/:segmentId', async (req, res) => {
  try {
    const { segmentId } = req.params;

    const summary = await getSummary(segmentId);

    res.json(summary);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch summary' });
  }
});

// POST new report
router.post('/', async (req, res) => {
  try {
    const { segment_id, reported_status, device_hash } = req.body;

    const allowedStatuses = ['open', 'closed', 'ungated'];

    if (!segment_id || !reported_status || !device_hash) {
      return res.status(400).json({
        success: false,
        message: 'Missing required fields'
      });
    }

    if (!allowedStatuses.includes(reported_status.toLowerCase())) {
      return res.status(400).json({
        success: false,
        message: 'Invalid status'
      });
    }

    const result = await submitReport({
      segment_id,
      reported_status: reported_status.toLowerCase(),
      device_hash
    });

    res.json(result);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to submit report' });
  }
});

export default router;