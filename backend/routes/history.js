import express from 'express';
import { Buyer, SentHistory, CampaignBuyer } from '../database.js';
import { authenticateToken } from './auth.js';

const router = express.Router();

router.use(authenticateToken);

// Get dashboard statistics
router.get('/stats', async (req, res) => {
  try {
    const totalBuyers = await Buyer.countDocuments();
    const totalSent = await SentHistory.countDocuments({ status: 'Success' });
    const totalFailed = await SentHistory.countDocuments({ status: 'Failed' });
    const pendingPrimary = await CampaignBuyer.countDocuments({ status: 'Pending' });
    
    const pendingFollowupsRes = await CampaignBuyer.aggregate([
      {
        $lookup: {
          from: 'buyers',
          localField: 'buyer_id',
          foreignField: '_id',
          as: 'buyer'
        }
      },
      { $unwind: '$buyer' },
      {
        $match: {
          $and: [
            {
              $or: [
                { followup_1_status: 'Pending', followup_1_date: { $ne: null } },
                { followup_2_status: 'Pending', followup_2_date: { $ne: null } }
              ]
            },
            { 'buyer.status': { $ne: 'Replied' } },
            { 'buyer.followup_status': { $ne: 'Stopped' } }
          ]
        }
      },
      { $count: 'count' }
    ]);

    const pendingFollowupsCount = pendingFollowupsRes[0] ? pendingFollowupsRes[0].count : 0;

    // Fetch daily activity for the last 7 days (grouping by date part of sent_at ISO string)
    const dailyActivity = await SentHistory.aggregate([
      { $match: { status: 'Success' } },
      {
        $group: {
          _id: { $substr: ['$sent_at', 0, 10] },
          count: { $sum: 1 }
        }
      },
      {
        $project: {
          _id: 0,
          date: '$_id',
          count: 1
        }
      },
      { $sort: { date: 1 } },
      { $limit: 7 }
    ]);

    res.json({
      totalBuyers,
      totalSent,
      totalFailed,
      pendingPrimary,
      pendingFollowups: pendingFollowupsCount,
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

  const filter = {};

  if (search) {
    filter.$or = [
      { company_name: { $regex: search, $options: 'i' } },
      { email_address: { $regex: search, $options: 'i' } },
      { subject: { $regex: search, $options: 'i' } }
    ];
  }
  if (status) {
    filter.status = status;
  }
  if (type) {
    filter.type = type;
  }

  try {
    const history = await SentHistory.find(filter).sort({ sent_at: -1 });
    res.json(history);
  } catch (error) {
    console.error('Error fetching sent history:', error);
    res.status(500).json({ error: 'Failed to fetch sent history.' });
  }
});

// 2. Clear all sent history logs
router.delete('/clear', async (req, res) => {
  try {
    await SentHistory.deleteMany({});
    res.json({ message: 'Sent history cleared successfully.' });
  } catch (error) {
    console.error('Error clearing sent history:', error);
    res.status(500).json({ error: 'Failed to clear history.' });
  }
});

export default router;
