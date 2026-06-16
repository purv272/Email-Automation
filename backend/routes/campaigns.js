import express from 'express';
import { dbQuery, dbGet, dbRun } from '../database.js';
import { authenticateToken } from './auth.js';
import { processPendingEmails } from '../scheduler.js';

const router = express.Router();

router.use(authenticateToken);

// 1. Get all campaigns with real-time stats
router.get('/', async (req, res) => {
  try {
    const campaigns = await dbQuery(`
      SELECT c.*, t.name as template_name,
        COUNT(cb.buyer_id) as total_buyers,
        SUM(CASE WHEN cb.status = 'Sent' THEN 1 ELSE 0 END) as sent_count,
        SUM(CASE WHEN cb.status = 'Failed' THEN 1 ELSE 0 END) as failed_count,
        SUM(CASE WHEN cb.status = 'Pending' THEN 1 ELSE 0 END) as pending_count
      FROM campaigns c
      LEFT JOIN templates t ON c.template_id = t.id
      LEFT JOIN campaign_buyers cb ON c.id = cb.campaign_id
      GROUP BY c.id
      ORDER BY c.id DESC
    `);
    
    // Parse attachments string to array for each campaign
    const processedCampaigns = campaigns.map(c => ({
      ...c,
      attachments: JSON.parse(c.attachments || '[]'),
      total_buyers: c.total_buyers || 0,
      sent_count: c.sent_count || 0,
      failed_count: c.failed_count || 0,
      pending_count: c.pending_count || 0
    }));

    res.json(processedCampaigns);
  } catch (error) {
    console.error('Error fetching campaigns:', error);
    res.status(500).json({ error: 'Failed to fetch campaigns.' });
  }
});

// 2. Get specific campaign with buyer list details
router.get('/:id', async (req, res) => {
  const { id } = req.params;
  try {
    const campaign = await dbGet(`
      SELECT c.*, t.name as template_name
      FROM campaigns c
      LEFT JOIN templates t ON c.template_id = t.id
      WHERE c.id = ?
    `, [id]);

    if (!campaign) {
      return res.status(404).json({ error: 'Campaign not found.' });
    }

    campaign.attachments = JSON.parse(campaign.attachments || '[]');

    // Get buyers associated with this campaign
    const buyers = await dbQuery(`
      SELECT cb.*, b.company_name, b.email, b.country, b.product_interest
      FROM campaign_buyers cb
      JOIN buyers b ON cb.buyer_id = b.id
      WHERE cb.campaign_id = ?
      ORDER BY b.company_name ASC
    `, [id]);

    res.json({
      campaign,
      buyers
    });
  } catch (error) {
    console.error('Error fetching campaign details:', error);
    res.status(500).json({ error: 'Failed to fetch campaign details.' });
  }
});

// 3. Create Campaign (handles selections, templates, and pre-customization)
router.post('/', async (req, res) => {
  const { name, template_id, buyer_ids, attachments, customizations } = req.body;

  if (!name || !template_id || !buyer_ids || !Array.isArray(buyer_ids) || buyer_ids.length === 0) {
    return res.status(400).json({ error: 'Campaign Name, Template, and at least one Buyer are required.' });
  }

  const createdAt = new Date().toISOString();
  const attachmentsJson = JSON.stringify(attachments || []);

  try {
    // Insert campaign metadata
    const campaignResult = await dbRun(`
      INSERT INTO campaigns (name, template_id, status, attachments, created_at)
      VALUES (?, ?, 'Draft', ?, ?)
    `, [name, template_id, attachmentsJson, createdAt]);

    const campaignId = campaignResult.id;

    // Insert relational entries for each buyer in this campaign
    for (const buyerId of buyer_ids) {
      // Check if there is an edited version for this buyer
      const custom = (customizations || []).find(item => item.buyer_id === buyerId);
      const customSubject = custom ? custom.custom_subject : null;
      const customBody = custom ? custom.custom_body : null;

      await dbRun(`
        INSERT INTO campaign_buyers (campaign_id, buyer_id, status, custom_subject, custom_body)
        VALUES (?, ?, 'Pending', ?, ?)
      `, [campaignId, buyerId, customSubject, customBody]);
    }

    const newCampaign = await dbGet('SELECT * FROM campaigns WHERE id = ?', [campaignId]);
    res.status(201).json(newCampaign);

  } catch (error) {
    console.error('Error creating campaign:', error);
    res.status(500).json({ error: 'Failed to create campaign.' });
  }
});

// 4. Start Campaign
router.post('/:id/start', async (req, res) => {
  const { id } = req.params;
  try {
    const campaign = await dbGet('SELECT * FROM campaigns WHERE id = ?', [id]);
    if (!campaign) {
      return res.status(404).json({ error: 'Campaign not found.' });
    }

    await dbRun("UPDATE campaigns SET status = 'Sending' WHERE id = ?", [id]);
    
    // Trigger the background scheduler immediately so sending begins instantly
    processPendingEmails().catch(err => console.error('Error in immediate queue process:', err));

    res.json({ message: 'Campaign started successfully. Sending queue is processing.', status: 'Sending' });
  } catch (error) {
    console.error('Error starting campaign:', error);
    res.status(500).json({ error: 'Failed to start campaign.' });
  }
});

// 5. Pause Campaign
router.post('/:id/pause', async (req, res) => {
  const { id } = req.params;
  try {
    const campaign = await dbGet('SELECT * FROM campaigns WHERE id = ?', [id]);
    if (!campaign) {
      return res.status(404).json({ error: 'Campaign not found.' });
    }

    await dbRun("UPDATE campaigns SET status = 'Paused' WHERE id = ?", [id]);
    res.json({ message: 'Campaign paused successfully.', status: 'Paused' });
  } catch (error) {
    console.error('Error pausing campaign:', error);
    res.status(500).json({ error: 'Failed to pause campaign.' });
  }
});

// 6. Delete Campaign
router.delete('/:id', async (req, res) => {
  const { id } = req.params;
  try {
    // Delete relational table first, then campaign
    await dbRun('DELETE FROM campaign_buyers WHERE campaign_id = ?', [id]);
    await dbRun('DELETE FROM campaigns WHERE id = ?', [id]);
    res.json({ message: 'Campaign deleted successfully.' });
  } catch (error) {
    console.error('Error deleting campaign:', error);
    res.status(500).json({ error: 'Failed to delete campaign.' });
  }
});

export default router;
