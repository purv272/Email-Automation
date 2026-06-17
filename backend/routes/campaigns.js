import express from 'express';
import { Campaign, CampaignBuyer, Template } from '../database.js';
import { authenticateToken } from './auth.js';
import { processPendingEmails } from '../scheduler.js';

const router = express.Router();

router.use(authenticateToken);

// 1. Get all campaigns with real-time stats
router.get('/', async (req, res) => {
  try {
    const campaigns = await Campaign.find().populate('template_id').sort({ _id: -1 });
    
    const processedCampaigns = await Promise.all(campaigns.map(async (c) => {
      const stats = await CampaignBuyer.aggregate([
        { $match: { campaign_id: c._id } },
        {
          $group: {
            _id: null,
            total: { $sum: 1 },
            sent: { $sum: { $cond: [{ $eq: ['$status', 'Sent'] }, 1, 0] } },
            failed: { $sum: { $cond: [{ $eq: ['$status', 'Failed'] }, 1, 0] } },
            pending: { $sum: { $cond: [{ $eq: ['$status', 'Pending'] }, 1, 0] } }
          }
        }
      ]);

      const stat = stats[0] || { total: 0, sent: 0, failed: 0, pending: 0 };
      
      return {
        id: c._id,
        _id: c._id,
        name: c.name,
        template_id: c.template_id ? c.template_id._id : null,
        template_name: c.template_id ? c.template_id.name : 'No Template',
        status: c.status,
        attachments: c.attachments || [],
        created_at: c.created_at,
        total_buyers: stat.total,
        sent_count: stat.sent,
        failed_count: stat.failed,
        pending_count: stat.pending
      };
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
    const campaign = await Campaign.findById(id).populate('template_id');

    if (!campaign) {
      return res.status(404).json({ error: 'Campaign not found.' });
    }

    const processedCampaign = {
      id: campaign._id,
      _id: campaign._id,
      name: campaign.name,
      template_id: campaign.template_id ? campaign.template_id._id : null,
      template_name: campaign.template_id ? campaign.template_id.name : 'No Template',
      status: campaign.status,
      attachments: campaign.attachments || [],
      created_at: campaign.created_at
    };

    // Get buyers associated with this campaign
    const cbList = await CampaignBuyer.find({ campaign_id: id }).populate('buyer_id');
    const buyers = cbList.map(cb => ({
      campaign_id: cb.campaign_id,
      buyer_id: cb.buyer_id ? cb.buyer_id._id : null,
      status: cb.status,
      sent_at: cb.sent_at,
      error_message: cb.error_message,
      custom_subject: cb.custom_subject,
      custom_body: cb.custom_body,
      followup_1_date: cb.followup_1_date,
      followup_1_status: cb.followup_1_status,
      followup_2_date: cb.followup_2_date,
      followup_2_status: cb.followup_2_status,
      company_name: cb.buyer_id ? cb.buyer_id.company_name : 'Deleted Buyer',
      email: cb.buyer_id ? cb.buyer_id.email : '',
      country: cb.buyer_id ? cb.buyer_id.country : '',
      product_interest: cb.buyer_id ? cb.buyer_id.product_interest : ''
    }));

    res.json({
      campaign: processedCampaign,
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

  try {
    // Insert campaign metadata
    const campaign = await Campaign.create({
      name,
      template_id,
      status: 'Draft',
      attachments: attachments || [],
      created_at: createdAt
    });

    // Insert relational entries for each buyer in this campaign
    for (const buyerId of buyer_ids) {
      // Check if there is an edited version for this buyer
      const custom = (customizations || []).find(item => item.buyer_id === buyerId);
      const customSubject = custom ? custom.custom_subject : null;
      const customBody = custom ? custom.custom_body : null;

      await CampaignBuyer.create({
        campaign_id: campaign._id,
        buyer_id: buyerId,
        status: 'Pending',
        custom_subject: customSubject,
        custom_body: customBody
      });
    }

    res.status(201).json(campaign);
  } catch (error) {
    console.error('Error creating campaign:', error);
    res.status(500).json({ error: 'Failed to create campaign.' });
  }
});

// 4. Start Campaign
router.post('/:id/start', async (req, res) => {
  const { id } = req.params;
  try {
    const campaign = await Campaign.findById(id);
    if (!campaign) {
      return res.status(404).json({ error: 'Campaign not found.' });
    }

    await Campaign.findByIdAndUpdate(id, { status: 'Sending' });
    
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
    const campaign = await Campaign.findById(id);
    if (!campaign) {
      return res.status(404).json({ error: 'Campaign not found.' });
    }

    await Campaign.findByIdAndUpdate(id, { status: 'Paused' });
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
    await CampaignBuyer.deleteMany({ campaign_id: id });
    await Campaign.findByIdAndDelete(id);
    res.json({ message: 'Campaign deleted successfully.' });
  } catch (error) {
    console.error('Error deleting campaign:', error);
    res.status(500).json({ error: 'Failed to delete campaign.' });
  }
});

export default router;
