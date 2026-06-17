import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';

const MONGODB_URI = process.env.MONGODB_URI || process.env.DATABASE_URL || 'mongodb://127.0.0.1:27017/email-automation';

// 1. User Schema
const UserSchema = new mongoose.Schema({
  username: { type: String, required: true, unique: true },
  password: { type: String, required: true }
});

// 2. Setting Schema
const SettingSchema = new mongoose.Schema({
  key: { type: String, required: true, unique: true },
  value: { type: String, default: '' }
});

// 3. Buyer Schema
const BuyerSchema = new mongoose.Schema({
  company_name: { type: String, required: true },
  email: { type: String, required: true, unique: true },
  country: { type: String, default: '' },
  website: { type: String, default: '' },
  product_interest: { type: String, default: '' },
  status: { type: String, default: 'Imported' },
  date_sent: { type: String, default: null },
  followup_status: { type: String, default: 'None' }
});

// 4. Template Schema
const TemplateSchema = new mongoose.Schema({
  name: { type: String, required: true },
  subject: { type: String, required: true },
  body: { type: String, required: true },
  created_at: { type: String, required: true }
});

// 5. Campaign Schema
const CampaignSchema = new mongoose.Schema({
  name: { type: String, required: true },
  template_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Template', required: true },
  status: { type: String, default: 'Draft' },
  attachments: { type: Array, default: [] },
  created_at: { type: String, required: true }
});

// 6. Campaign Buyer Schema
const CampaignBuyerSchema = new mongoose.Schema({
  campaign_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Campaign', required: true },
  buyer_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Buyer', required: true },
  status: { type: String, default: 'Pending' },
  sent_at: { type: String, default: null },
  error_message: { type: String, default: null },
  custom_subject: { type: String, default: null },
  custom_body: { type: String, default: null },
  followup_1_date: { type: String, default: null },
  followup_1_status: { type: String, default: 'Pending' },
  followup_2_date: { type: String, default: null },
  followup_2_status: { type: String, default: 'Pending' }
});

// Set compound index to simulate primary key behavior
CampaignBuyerSchema.index({ campaign_id: 1, buyer_id: 1 }, { unique: true });

// 7. Sent History Schema
const SentHistorySchema = new mongoose.Schema({
  buyer_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Buyer' },
  campaign_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Campaign' },
  email_address: { type: String, required: true },
  company_name: { type: String, required: true },
  subject: { type: String, required: true },
  body: { type: String, required: true },
  type: { type: String, required: true },
  sent_at: { type: String, required: true },
  status: { type: String, required: true },
  error_message: { type: String, default: null }
});

// Export Models
export const User = mongoose.model('User', UserSchema);
export const Setting = mongoose.model('Setting', SettingSchema);
export const Buyer = mongoose.model('Buyer', BuyerSchema);
export const Template = mongoose.model('Template', TemplateSchema);
export const Campaign = mongoose.model('Campaign', CampaignSchema);
export const CampaignBuyer = mongoose.model('CampaignBuyer', CampaignBuyerSchema);
export const SentHistory = mongoose.model('SentHistory', SentHistorySchema);

// Database Initialization & Connection
export const initDatabase = async () => {
  try {
    console.log(`Connecting to MongoDB at: ${MONGODB_URI.replace(/:([^:@]+)@/, ':****@')}`);
    await mongoose.connect(MONGODB_URI);
    console.log('Connected to MongoDB successfully.');

    // Setup Default Admin User if it doesn't exist
    const adminExists = await User.findOne({ username: 'admin' });
    if (!adminExists) {
      const salt = await bcrypt.genSalt(10);
      const hashedPassword = await bcrypt.hash('admin123', salt);
      await User.create({ username: 'admin', password: hashedPassword });
      console.log('Default administrator account created: admin / admin123');
    }

    // Setup Default Settings
    const defaultSettings = {
      smtp_host: '',
      smtp_port: '587',
      smtp_secure: 'false',
      smtp_user: '',
      smtp_pass: '',
      sender_email: '',
      sending_delay: '3',
      email_signature: '\n\nRegards,\nUgam\nVe Veyron Exports',
      gemini_api_key: '',
      followup_1_delay: '7',
      followup_2_delay: '15',
      followup_1_template_id: '',
      followup_2_template_id: ''
    };

    for (const [key, val] of Object.entries(defaultSettings)) {
      const settingExists = await Setting.findOne({ key });
      if (!settingExists) {
        await Setting.create({ key, value: val });
      }
    }
    console.log('Default settings checks completed.');
  } catch (error) {
    console.error('MongoDB initialization failed:', error);
    throw error;
  }
};

export default mongoose;
