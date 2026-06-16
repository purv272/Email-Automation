import express from 'express';
import { dbQuery, dbGet, dbRun } from '../database.js';
import { authenticateToken } from './auth.js';

const router = express.Router();

router.use(authenticateToken);

// Get dashboard statistics
router.get('/stats', async (req, res) => {
  try {
    const totalBuyers = await dbGet('SELECT COUNT(*) as count FROM buyers');
    const totalSent = await dbGet("SELECT COUNT(*) as count FROM sent_history WHERE status = 'Success'");
    const totalFailed = await dbGet("SELECT COUNT(*) as count FROM sent_history WHERE status = 'Failed'");
    const pendingPrimary = await dbGet("SELECT COUNT(*) as count FROM campaign_buyers WHERE status = 'Pending'");
    
    const pendingFollowups = await dbGet(`
      SELECT COUNT(*) as count FROM campaign_buyers cb
      JOIN buyers b ON cb.buyer_id = b.id
      WHERE (cb.followup_1_status = 'Pending' AND cb.followup_1_date IS NOT NULL) 
         OR (cb.followup_2_status = 'Pending' AND cb.followup_2_date IS NOT NULL)
         AND b.status != 'Replied'
         AND b.followup_status != 'Stopped'
    `);

    // Fetch daily activity for the last 7 days
    const dailyActivity = await dbQuery(`
      SELECT date(sent_at) as date, COUNT(*) as count 
      FROM sent_history 
      WHERE status = 'Success' 
      GROUP BY date(sent_at) 
      ORDER BY date(sent_at) ASC 
      LIMIT 7
    `);

    res.json({
      totalBuyers: totalBuyers.count,
      totalSent: totalSent.count,
      totalFailed: totalFailed.count,
      pendingPrimary: pendingPrimary.count,
      pendingFollowups: pendingFollowups.count,
      dailyActivity: dailyActivity || []
    });
  } catch (error) {
    console.error('Error fetching dashboard stats:', error);
    res.status(500).json({ error: 'Failed to fetch dashboard statistics.' });
  }
});

// 1. Get all sent history logs with filters and search
router.get('/', async (req, res) => {
  const { search, status, type } = req.query;

  let query = 'SELECT * FROM sent_history WHERE 1=1';
  const params = [];

  if (search) {
    query += ' AND (company_name LIKE ? OR email_address LIKE ? OR subject LIKE ?)';
    params.push(`%${search}%`, `%${search}%`, `%${search}%`);
  }
  if (status) {
    query += ' AND status = ?';
    params.push(status);
  }
  if (type) {
    query += ' AND type = ?';
    params.push(type);
  }

  query += ' ORDER BY sent_at DESC';

  try {
    const history = await dbQuery(query, params);
    res.json(history);
  } catch (error) {
    console.error('Error fetching sent history:', error);
    res.status(500).json({ error: 'Failed to fetch sent history.' });
  }
});

// 2. Clear all sent history logs
router.delete('/clear', async (req, res) => {
  try {
    await dbRun('DELETE FROM sent_history');
    res.json({ message: 'Sent history cleared successfully.' });
  } catch (error) {
    console.error('Error clearing sent history:', error);
    res.status(500).json({ error: 'Failed to clear history.' });
  }
});

export default router;
