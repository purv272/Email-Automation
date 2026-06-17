import nodemailer from 'nodemailer';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { Setting, Campaign, CampaignBuyer, Buyer, Template, SentHistory } from './database.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Helper to convert plain text with markdown bolding to HTML
const convertTextToHtml = (text) => {
  if (!text) return '';
  let html = text;
  // Convert markdown bold **text** to <strong>text</strong>
  html = html.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
  // Convert markdown links [Text](Url) to <a href="Url">Text</a>
  html = html.replace(/\[(.*?)\]\((.*?)\)/g, '<a href="$2">$1</a>');
  // Convert standard newlines to <br> tags
  html = html.replace(/\r?\n/g, '<br>');
  return html;
};

let schedulerInterval = null;
let isProcessing = false;

// SMTP verification helper
export const verifySmtp = async (config) => {
  const secure = config.smtp_secure === 'true' || config.smtp_secure === true;
  const transporter = nodemailer.createTransport({
    host: config.smtp_host,
    port: parseInt(config.smtp_port, 10) || 587,
    secure: secure,
    auth: {
      user: config.smtp_user,
      pass: config.smtp_pass,
    },
    connectionTimeout: 10000,
    greetingTimeout: 10000,
  });
  return transporter.verify();
};

// Retrieve SMTP Transporter using latest database settings
const getTransporter = async () => {
  const settingsRows = await Setting.find();
  const config = {};
  settingsRows.forEach((row) => {
    config[row.key] = row.value;
  });

  if (!config.smtp_host || !config.smtp_user || !config.smtp_pass) {
    throw new Error('SMTP credentials are not fully configured in Settings.');
  }

  const secure = config.smtp_secure === 'true' || config.smtp_secure === true;
  return {
    transporter: nodemailer.createTransport({
      host: config.smtp_host,
      port: parseInt(config.smtp_port, 10) || 587,
      secure: secure,
      auth: {
        user: config.smtp_user,
        pass: config.smtp_pass,
      },
      connectionTimeout: 15000, // 15 seconds
      greetingTimeout: 15000,   // 15 seconds
      socketTimeout: 30000,     // 30 seconds
    }),
    senderEmail: config.sender_email || config.smtp_user,
    signature: config.email_signature || '',
    settings: config
  };
};

// Replace template variables
const personalizeText = (text, buyer) => {
  if (!text) return '';
  let personalized = text;
  personalized = personalized.replace(/{{Company_Name}}/g, buyer.company_name || 'Partner');
  personalized = personalized.replace(/{{Email}}/g, buyer.email || '');
  personalized = personalized.replace(/{{Country}}/g, buyer.country || '');
  personalized = personalized.replace(/{{Product_Interest}}/g, buyer.product_interest || '');
  return personalized;
};

// Main task runner: Process one pending email (primary or follow-up)
export const processPendingEmails = async () => {
  if (isProcessing) return;
  isProcessing = true;

  try {
    const mailConfig = await getTransporter().catch((err) => {
      // Incomplete SMTP configuration
      console.warn('Scheduler SMTP Check: ' + err.message);
      return null;
    });

    if (!mailConfig) {
      isProcessing = false;
      return;
    }

    const { transporter, senderEmail, signature, settings } = mailConfig;
    const sendDelaySeconds = parseInt(settings.sending_delay, 10) || 3;
    const sendDelayMs = sendDelaySeconds * 1000;

    let hasMoreEmails = true;

    while (hasMoreEmails) {
      // 1. PROCESS PRIMARY CAMPAIGN EMAILS
      // Find active campaigns
      const activeCampaigns = await Campaign.find({ status: 'Sending' });
      let emailSentInThisIteration = false;

      for (const campaign of activeCampaigns) {
        // Find one pending buyer in this campaign
        const pendingBuyerCB = await CampaignBuyer.findOne({
          campaign_id: campaign._id,
          status: 'Pending'
        }).populate('buyer_id');

        if (pendingBuyerCB) {
          const pendingBuyer = {
            campaign_id: pendingBuyerCB.campaign_id,
            buyer_id: pendingBuyerCB.buyer_id ? pendingBuyerCB.buyer_id._id : null,
            status: pendingBuyerCB.status,
            custom_subject: pendingBuyerCB.custom_subject,
            custom_body: pendingBuyerCB.custom_body,
            company_name: pendingBuyerCB.buyer_id ? pendingBuyerCB.buyer_id.company_name : 'Partner',
            email: pendingBuyerCB.buyer_id ? pendingBuyerCB.buyer_id.email : '',
            country: pendingBuyerCB.buyer_id ? pendingBuyerCB.buyer_id.country : '',
            product_interest: pendingBuyerCB.buyer_id ? pendingBuyerCB.buyer_id.product_interest : '',
            buyer_status: pendingBuyerCB.buyer_id ? pendingBuyerCB.buyer_id.status : ''
          };

          // Send this email!
          await sendPrimaryEmail(campaign, pendingBuyer, transporter, senderEmail, signature, settings);
          emailSentInThisIteration = true;
          break; // Break campaign loop to sleep and check status again in next iteration
        } else {
          // No more pending buyers in this campaign. Check if all sent/failed
          const pendingCount = await CampaignBuyer.countDocuments({
            campaign_id: campaign._id,
            status: 'Pending'
          });

          if (pendingCount === 0) {
            // Mark campaign as completed
            await Campaign.findByIdAndUpdate(campaign._id, { status: 'Completed' });
            console.log(`Campaign "${campaign.name}" completed.`);
          }
        }
      }

      // 2. PROCESS PENDING FOLLOW-UPS
      if (!emailSentInThisIteration) {
        const nowIso = new Date().toISOString();

        // Check Follow-up 1
        const followup1Results = await CampaignBuyer.aggregate([
          {
            $match: {
              status: 'Sent',
              followup_1_status: 'Pending',
              followup_1_date: { $lte: nowIso }
            }
          },
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
            $lookup: {
              from: 'campaigns',
              localField: 'campaign_id',
              foreignField: '_id',
              as: 'campaign'
            }
          },
          { $unwind: '$campaign' },
          {
            $match: {
              'buyer.status': { $ne: 'Replied' },
              'buyer.followup_status': { $ne: 'Stopped' }
            }
          },
          { $limit: 1 }
        ]);

        if (followup1Results.length > 0) {
          const doc = followup1Results[0];
          const pendingFollowup1 = {
            campaign_id: doc.campaign_id,
            buyer_id: doc.buyer_id,
            status: doc.status,
            custom_subject: doc.custom_subject,
            custom_body: doc.custom_body,
            company_name: doc.buyer.company_name,
            email: doc.buyer.email,
            country: doc.buyer.country,
            product_interest: doc.buyer.product_interest,
            buyer_status: doc.buyer.status,
            campaign_name: doc.campaign.name
          };

          await sendFollowupEmail(1, pendingFollowup1, transporter, senderEmail, signature, settings);
          emailSentInThisIteration = true;
        } else {
          // Check Follow-up 2
          const followup2Results = await CampaignBuyer.aggregate([
            {
              $match: {
                status: 'Sent',
                followup_1_status: 'Sent',
                followup_2_status: 'Pending',
                followup_2_date: { $lte: nowIso }
              }
            },
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
              $lookup: {
                from: 'campaigns',
                localField: 'campaign_id',
                foreignField: '_id',
                as: 'campaign'
              }
            },
            { $unwind: '$campaign' },
            {
              $match: {
                'buyer.status': { $ne: 'Replied' },
                'buyer.followup_status': { $ne: 'Stopped' }
              }
            },
            { $limit: 1 }
          ]);

          if (followup2Results.length > 0) {
            const doc = followup2Results[0];
            const pendingFollowup2 = {
              campaign_id: doc.campaign_id,
              buyer_id: doc.buyer_id,
              status: doc.status,
              custom_subject: doc.custom_subject,
              custom_body: doc.custom_body,
              company_name: doc.buyer.company_name,
              email: doc.buyer.email,
              country: doc.buyer.country,
              product_interest: doc.buyer.product_interest,
              buyer_status: doc.buyer.status,
              campaign_name: doc.campaign.name
            };

            await sendFollowupEmail(2, pendingFollowup2, transporter, senderEmail, signature, settings);
            emailSentInThisIteration = true;
          }
        }
      }

      // If an email was sent in this iteration, wait before checking/sending the next one
      if (emailSentInThisIteration) {
        await new Promise((resolve) => setTimeout(resolve, sendDelayMs));
      } else {
        // No more pending emails (primary or follow-ups) found, exit queue loop
        hasMoreEmails = false;
      }
    }

  } catch (error) {
    console.error('Error in scheduler processing:', error);
  } finally {
    isProcessing = false;
  }
};

// Send Primary Campaign Email
const sendPrimaryEmail = async (campaign, cbBuyer, transporter, senderEmail, signature, settings) => {
  const sentAt = new Date().toISOString();
  let subject = cbBuyer.custom_subject;
  let body = cbBuyer.custom_body;

  // Fallback to template if no customization is stored
  if (!subject || !body) {
    const template = await Template.findById(campaign.template_id);
    if (template) {
      subject = personalizeText(subject || template.subject, cbBuyer);
      body = personalizeText(body || template.body, cbBuyer);
    } else {
      subject = `Spice export offerings from Ve Veyron Exports`;
      body = `Dear ${cbBuyer.company_name} Team,\n\nWe would love to export spices to you.`;
    }
  }

  // Append Signature
  if (signature && !body.includes(signature.trim())) {
    body += signature;
  }

  // Handle Attachments
  let attachmentPaths = [];
  try {
    attachmentPaths = campaign.attachments || [];
  } catch (e) {
    attachmentPaths = [];
  }

  const attachments = attachmentPaths.map((filePath) => {
    return {
      filename: path.basename(filePath),
      path: path.resolve(__dirname, 'uploads', filePath),
    };
  }).filter(item => fs.existsSync(item.path));

  try {
    await transporter.sendMail({
      from: `"Ve Veyron Exports" <${senderEmail}>`,
      to: cbBuyer.email,
      subject: subject,
      text: body,
      html: convertTextToHtml(body),
      attachments: attachments,
    });

    // Calculate follow-up dates
    const delay1 = parseInt(settings.followup_1_delay, 10) || 7;
    const delay2 = parseInt(settings.followup_2_delay, 10) || 15;

    const f1Date = new Date();
    f1Date.setDate(f1Date.getDate() + delay1);

    const f2Date = new Date();
    f2Date.setDate(f2Date.getDate() + delay2);

    // Update campaign buyer record
    await CampaignBuyer.findOneAndUpdate(
      { campaign_id: cbBuyer.campaign_id, buyer_id: cbBuyer.buyer_id },
      {
        status: 'Sent',
        sent_at: sentAt,
        followup_1_date: f1Date.toISOString(),
        followup_1_status: 'Pending',
        followup_2_date: f2Date.toISOString(),
        followup_2_status: 'Pending',
        error_message: null
      }
    );

    // Update main buyer record
    await Buyer.findByIdAndUpdate(
      cbBuyer.buyer_id,
      {
        status: 'Emailed',
        date_sent: sentAt,
        followup_status: 'None'
      }
    );

    // Add to Sent History audit log
    await SentHistory.create({
      buyer_id: cbBuyer.buyer_id,
      campaign_id: cbBuyer.campaign_id,
      email_address: cbBuyer.email,
      company_name: cbBuyer.company_name,
      subject: subject,
      body: body,
      type: 'Primary',
      sent_at: sentAt,
      status: 'Success'
    });

    console.log(`Successfully sent primary email to ${cbBuyer.company_name} (${cbBuyer.email})`);

  } catch (error) {
    console.error(`Failed to send primary email to ${cbBuyer.company_name}:`, error);

    // Record error in campaign buyer
    await CampaignBuyer.findOneAndUpdate(
      { campaign_id: cbBuyer.campaign_id, buyer_id: cbBuyer.buyer_id },
      { status: 'Failed', error_message: error.message }
    );

    // Record history
    await SentHistory.create({
      buyer_id: cbBuyer.buyer_id,
      campaign_id: cbBuyer.campaign_id,
      email_address: cbBuyer.email,
      company_name: cbBuyer.company_name,
      subject: subject,
      body: body,
      type: 'Primary',
      sent_at: sentAt,
      status: 'Failed',
      error_message: error.message
    });
  }
};

// Send Follow-up Email
const sendFollowupEmail = async (num, cbBuyer, transporter, senderEmail, signature, settings) => {
  const sentAt = new Date().toISOString();
  
  // Retrieve template configured for follow-up
  const templateIdKey = `followup_${num}_template_id`;
  const templateId = settings[templateIdKey];
  
  let subject = '';
  let body = '';

  if (templateId) {
    const template = await Template.findById(templateId);
    if (template) {
      subject = personalizeText(template.subject, cbBuyer);
      body = personalizeText(template.body, cbBuyer);
    }
  }

  // Standard Fallback Follow-up Text if none configured
  if (!subject || !body) {
    if (num === 1) {
      subject = `Follow up: Spice sourcing with Ve Veyron Exports`;
      body = `Hi ${cbBuyer.company_name} Team,\n\nI hope you're doing well.\n\nI wanted to follow up on my previous email regarding our premium Indian spice exports. We supply Turmeric, Chilli, Cumin, Coriander, Onion, and Garlic powders.\n\nPlease let us know if you have any requirements.`;
    } else {
      subject = `Final check: Spice Sourcing - Ve Veyron Exports`;
      body = `Hi ${cbBuyer.company_name} Team,\n\nI wanted to check in one last time to see if you have any open requirements for quality spices.\n\nIf you'd like us to send quotes or our detailed price list, please let us know.`;
    }
  }

  // Append Signature
  if (signature && !body.includes(signature.trim())) {
    body += signature;
  }

  try {
    await transporter.sendMail({
      from: `"Ve Veyron Exports" <${senderEmail}>`,
      to: cbBuyer.email,
      subject: subject,
      text: body,
      html: convertTextToHtml(body),
    });

    const statusField = `followup_${num}_status`;
    const buyerFollowupStatus = `Followup ${num} Sent`;

    // Update campaign buyer
    const updateCB = {};
    updateCB[statusField] = 'Sent';
    await CampaignBuyer.findOneAndUpdate(
      { campaign_id: cbBuyer.campaign_id, buyer_id: cbBuyer.buyer_id },
      updateCB
    );

    // Update main buyer status
    await Buyer.findByIdAndUpdate(
      cbBuyer.buyer_id,
      { followup_status: buyerFollowupStatus }
    );

    // Audit logs
    await SentHistory.create({
      buyer_id: cbBuyer.buyer_id,
      campaign_id: cbBuyer.campaign_id,
      email_address: cbBuyer.email,
      company_name: cbBuyer.company_name,
      subject: subject,
      body: body,
      type: `Follow-up ${num}`,
      sent_at: sentAt,
      status: 'Success'
    });

    console.log(`Successfully sent Follow-up ${num} to ${cbBuyer.company_name} (${cbBuyer.email})`);

  } catch (error) {
    console.error(`Failed to send Follow-up ${num} to ${cbBuyer.company_name}:`, error);

    const statusField = `followup_${num}_status`;
    const updateCB = {};
    updateCB[statusField] = 'Failed';
    await CampaignBuyer.findOneAndUpdate(
      { campaign_id: cbBuyer.campaign_id, buyer_id: cbBuyer.buyer_id },
      updateCB
    );

    await SentHistory.create({
      buyer_id: cbBuyer.buyer_id,
      campaign_id: cbBuyer.campaign_id,
      email_address: cbBuyer.email,
      company_name: cbBuyer.company_name,
      subject: subject,
      body: body,
      type: `Follow-up ${num}`,
      sent_at: sentAt,
      status: 'Failed',
      error_message: error.message
    });
  }
};

// Start Background Scheduler Loop
export const startScheduler = (intervalMs = 60000) => {
  if (schedulerInterval) {
    clearInterval(schedulerInterval);
  }
  console.log(`Scheduler started. Checking every ${intervalMs / 1000}s...`);
  // First run immediately
  setTimeout(processPendingEmails, 2000);
  schedulerInterval = setInterval(processPendingEmails, intervalMs);
};

// Stop Background Scheduler Loop
export const stopScheduler = () => {
  if (schedulerInterval) {
    clearInterval(schedulerInterval);
    schedulerInterval = null;
    console.log('Scheduler stopped.');
  }
};
