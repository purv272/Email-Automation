import express from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { dbQuery, dbGet, dbRun } from '../database.js';
import { authenticateToken } from './auth.js';
import { verifySmtp } from '../scheduler.js';

const router = express.Router();

// Configure Multer for attachments upload
const attachmentsDir = 'uploads/attachments';
if (!fs.existsSync(attachmentsDir)) {
  fs.mkdirSync(attachmentsDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, attachmentsDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    cb(null, uniqueSuffix + '-' + file.originalname);
  }
});

const upload = multer({
  storage: storage,
  fileFilter: (req, file, cb) => {
    // Allow PDFs, DOCs, TXT, Excel and standard images
    const filetypes = /pdf|doc|docx|txt|xls|xlsx|png|jpg|jpeg/;
    const extname = filetypes.test(path.extname(file.originalname).toLowerCase());
    if (extname) {
      return cb(null, true);
    }
    cb(new Error('Invalid file type for attachments.'));
  }
});

router.use(authenticateToken);

// 1. Get all settings as a key-value object
router.get('/', async (req, res) => {
  try {
    const rows = await dbQuery('SELECT * FROM settings');
    const settings = {};
    rows.forEach((row) => {
      settings[row.key] = row.value;
    });
    res.json(settings);
  } catch (error) {
    console.error('Error getting settings:', error);
    res.status(500).json({ error: 'Failed to retrieve settings.' });
  }
});

// 2. Save settings (accepts key-value pair dictionary)
router.post('/', async (req, res) => {
  const settingsDict = req.body;
  
  try {
    for (const [key, value] of Object.entries(settingsDict)) {
      // Convert to string for storage
      const valStr = typeof value === 'object' ? JSON.stringify(value) : (value !== null && value !== undefined ? value.toString() : '');
      
      const exists = await dbGet('SELECT * FROM settings WHERE key = ?', [key]);
      if (exists) {
        await dbRun('UPDATE settings SET value = ? WHERE key = ?', [valStr, key]);
      } else {
        await dbRun('INSERT INTO settings (key, value) VALUES (?, ?)', [key, valStr]);
      }
    }
    res.json({ message: 'Settings saved successfully.' });
  } catch (error) {
    console.error('Error saving settings:', error);
    res.status(500).json({ error: 'Failed to save settings.' });
  }
});

// 3. Test SMTP connection
router.post('/test-smtp', async (req, res) => {
  const { smtp_host, smtp_port, smtp_secure, smtp_user, smtp_pass } = req.body;

  if (!smtp_host || !smtp_user || !smtp_pass) {
    return res.status(400).json({ error: 'SMTP Host, Username, and Password are required.' });
  }

  try {
    await verifySmtp({ smtp_host, smtp_port, smtp_secure, smtp_user, smtp_pass });
    res.json({ success: true, message: 'SMTP connection verified successfully!' });
  } catch (error) {
    console.error('SMTP verify error:', error);
    res.status(400).json({ success: false, error: error.message });
  }
});

// 4. Upload Attachment
router.post('/upload-attachment', upload.single('file'), async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'No file uploaded.' });
  }

  const fileDetail = {
    id: Date.now().toString(),
    name: req.file.originalname,
    path: `attachments/${req.file.filename}`, // Relative path under uploads/
    size: req.file.size
  };

  try {
    // Fetch current default attachments list
    const currentSettingsRow = await dbGet("SELECT value FROM settings WHERE key = 'default_attachments'");
    let attachmentsList = [];
    if (currentSettingsRow && currentSettingsRow.value) {
      attachmentsList = JSON.parse(currentSettingsRow.value);
    }

    attachmentsList.push(fileDetail);

    // Save back to settings
    const valStr = JSON.stringify(attachmentsList);
    const exists = await dbGet("SELECT * FROM settings WHERE key = 'default_attachments'");
    if (exists) {
      await dbRun("UPDATE settings SET value = ? WHERE key = 'default_attachments'", [valStr]);
    } else {
      await dbRun("INSERT INTO settings (key, value) VALUES ('default_attachments', ?)", [valStr]);
    }

    res.json({
      message: 'Attachment uploaded successfully.',
      attachment: fileDetail,
      attachmentsList
    });

  } catch (error) {
    console.error('Attachment save error:', error);
    // Delete file if saved but failed database update
    if (req.file && fs.existsSync(req.file.path)) {
      fs.unlinkSync(req.file.path);
    }
    res.status(500).json({ error: 'Failed to save attachment metadata.' });
  }
});

// 5. Delete Attachment
router.delete('/attachment/:id', async (req, res) => {
  const { id } = req.params;

  try {
    const currentSettingsRow = await dbGet("SELECT value FROM settings WHERE key = 'default_attachments'");
    if (!currentSettingsRow || !currentSettingsRow.value) {
      return res.status(404).json({ error: 'No attachments found.' });
    }

    let attachmentsList = JSON.parse(currentSettingsRow.value);
    const targetIndex = attachmentsList.findIndex(a => a.id === id);

    if (targetIndex === -1) {
      return res.status(404).json({ error: 'Attachment not found.' });
    }

    const attachment = attachmentsList[targetIndex];
    const fileAbsPath = path.resolve('uploads', attachment.path);

    // Delete file from disk if it exists
    if (fs.existsSync(fileAbsPath)) {
      fs.unlinkSync(fileAbsPath);
    }

    // Remove from array and save settings
    attachmentsList.splice(targetIndex, 1);
    await dbRun("UPDATE settings SET value = ? WHERE key = 'default_attachments'", [JSON.stringify(attachmentsList)]);

    res.json({
      message: 'Attachment deleted successfully.',
      attachmentsList
    });

  } catch (error) {
    console.error('Attachment delete error:', error);
    res.status(500).json({ error: 'Failed to delete attachment.' });
  }
});

export default router;
