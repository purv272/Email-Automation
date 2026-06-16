import express from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import csv from 'csv-parser';
import xlsx from 'xlsx';
import { dbQuery, dbGet, dbRun } from '../database.js';
import { authenticateToken } from './auth.js';
import { classifyBuyer } from '../aiService.js';

const router = express.Router();

// Helper to generate simple random string
const getRandomToken = () => {
  return Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
};

// Configure Multer for Excel/CSV file upload
const uploadDir = 'uploads/temp';
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({
  storage: storage,
  fileFilter: (req, file, cb) => {
    const filetypes = /csv|xlsx|xls/;
    const extname = filetypes.test(path.extname(file.originalname).toLowerCase());
    if (extname) {
      return cb(null, true);
    }
    cb(new Error('Only Excel (.xlsx, .xls) or CSV files are allowed.'));
  }
});

// Protect all buyer endpoints
router.use(authenticateToken);

// 1. Get all buyers (with filters and search)
router.get('/', async (req, res) => {
  const { search, country, status, followup_status } = req.query;

  let query = 'SELECT * FROM buyers WHERE 1=1';
  const params = [];

  if (search) {
    query += ' AND (company_name LIKE ? OR email LIKE ? OR product_interest LIKE ?)';
    params.push(`%${search}%`, `%${search}%`, `%${search}%`);
  }
  if (country) {
    query += ' AND country = ?';
    params.push(country);
  }
  if (status) {
    query += ' AND status = ?';
    params.push(status);
  }
  if (followup_status) {
    query += ' AND followup_status = ?';
    params.push(followup_status);
  }

  query += ' ORDER BY id DESC';

  try {
    const buyers = await dbQuery(query, params);
    res.json(buyers);
  } catch (error) {
    console.error('Error fetching buyers:', error);
    res.status(500).json({ error: 'Failed to fetch buyers.' });
  }
});

// 2. Add single buyer manually
router.post('/', async (req, res) => {
  const { company_name, email, country, website, product_interest } = req.body;

  if (!company_name || !email) {
    return res.status(400).json({ error: 'Company Name and Email are required.' });
  }

  try {
    // Check if duplicate
    const existing = await dbGet('SELECT * FROM buyers WHERE email = ?', [email]);
    if (existing) {
      return res.status(400).json({ error: 'A buyer with this email address already exists.' });
    }

    const result = await dbRun(`
      INSERT INTO buyers (company_name, email, country, website, product_interest, status, followup_status)
      VALUES (?, ?, ?, ?, ?, 'Imported', 'None')
    `, [company_name, email, country || '', website || '', product_interest || '']);

    const newBuyer = await dbGet('SELECT * FROM buyers WHERE id = ?', [result.id]);
    res.status(201).json(newBuyer);
  } catch (error) {
    console.error('Error creating buyer:', error);
    res.status(500).json({ error: 'Failed to add buyer.' });
  }
});

// 3. Update single buyer
router.put('/:id', async (req, res) => {
  const { id } = req.params;
  const { company_name, email, country, website, product_interest, status, followup_status } = req.body;

  if (!company_name || !email) {
    return res.status(400).json({ error: 'Company Name and Email are required.' });
  }

  try {
    // Check if email is already taken by another buyer
    const existing = await dbGet('SELECT * FROM buyers WHERE email = ? AND id != ?', [email, id]);
    if (existing) {
      return res.status(400).json({ error: 'Another buyer already has this email address.' });
    }

    await dbRun(`
      UPDATE buyers 
      SET company_name = ?, email = ?, country = ?, website = ?, product_interest = ?, status = ?, followup_status = ?
      WHERE id = ?
    `, [company_name, email, country, website, product_interest, status, followup_status, id]);

    const updated = await dbGet('SELECT * FROM buyers WHERE id = ?', [id]);
    res.json(updated);
  } catch (error) {
    console.error('Error updating buyer:', error);
    res.status(500).json({ error: 'Failed to update buyer.' });
  }
});

// 4. Delete buyer
router.delete('/:id', async (req, res) => {
  const { id } = req.params;
  try {
    await dbRun('DELETE FROM buyers WHERE id = ?', [id]);
    res.json({ message: 'Buyer deleted successfully.' });
  } catch (error) {
    console.error('Error deleting buyer:', error);
    res.status(500).json({ error: 'Failed to delete buyer.' });
  }
});

// 5. Upload File - Parses headers and saves data in temporary file
router.post('/upload', upload.single('file'), async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'Please upload an Excel or CSV file.' });
  }

  const filePath = req.file.path;
  const fileExt = path.extname(req.file.originalname).toLowerCase();
  const fileToken = getRandomToken();
  const tempJsonPath = path.resolve(uploadDir, `${fileToken}.json`);

  let headers = [];
  let rows = [];

  try {
    if (fileExt === '.csv') {
      // Parse CSV
      await new Promise((resolve, reject) => {
        fs.createReadStream(filePath)
          .pipe(csv())
          .on('headers', (headersList) => {
            headers = headersList;
          })
          .on('data', (data) => {
            rows.push(data);
          })
          .on('end', () => {
            resolve();
          })
          .on('error', (err) => {
            reject(err);
          });
      });
    } else {
      // Parse Excel (.xlsx, .xls)
      const workbook = xlsx.readFile(filePath);
      const sheetName = workbook.SheetNames[0];
      const sheet = workbook.Sheets[sheetName];
      // Convert to JSON including header row
      const data = xlsx.utils.sheet_to_json(sheet, { defval: '' });
      if (data.length > 0) {
        headers = Object.keys(data[0]);
        rows = data;
      }
    }

    // Save rows into temporary JSON file
    fs.writeFileSync(tempJsonPath, JSON.stringify(rows));

    // Cleanup uploaded raw file
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }

    res.json({
      fileToken,
      headers,
      totalRecords: rows.length
    });

  } catch (error) {
    console.error('File parsing error:', error);
    // Cleanup files on error
    if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
    if (fs.existsSync(tempJsonPath)) fs.unlinkSync(tempJsonPath);
    res.status(500).json({ error: 'Failed to parse the uploaded file.' });
  }
});

// 6. Complete Import - Takes column mapping and saves to Database
router.post('/import', async (req, res) => {
  const { fileToken, mappings } = req.body;

  if (!fileToken || !mappings || !mappings.company_name || !mappings.email) {
    return res.status(400).json({ error: 'Missing token or required mappings (Company Name & Email).' });
  }

  const tempJsonPath = path.resolve(uploadDir, `${fileToken}.json`);

  if (!fs.existsSync(tempJsonPath)) {
    return res.status(400).json({ error: 'Upload session expired or invalid. Please upload file again.' });
  }

  try {
    const rawData = fs.readFileSync(tempJsonPath, 'utf8');
    const rows = JSON.parse(rawData);

    let importCount = 0;
    let duplicateCount = 0;
    let errorCount = 0;

    for (const row of rows) {
      const companyName = row[mappings.company_name];
      const email = row[mappings.email];
      const country = mappings.country ? row[mappings.country] : '';
      const website = mappings.website ? row[mappings.website] : '';
      const productInterest = mappings.product_interest ? row[mappings.product_interest] : '';

      if (!companyName || !email) {
        errorCount++;
        continue;
      }

      const trimmedEmail = email.trim().toLowerCase();

      try {
        // Query to check duplicate email
        const existing = await dbGet('SELECT id FROM buyers WHERE email = ?', [trimmedEmail]);
        if (existing) {
          duplicateCount++;
          continue;
        }

        await dbRun(`
          INSERT INTO buyers (company_name, email, country, website, product_interest, status, followup_status)
          VALUES (?, ?, ?, ?, ?, 'Imported', 'None')
        `, [companyName.trim(), trimmedEmail, country ? country.toString().trim() : '', website ? website.toString().trim() : '', productInterest ? productInterest.toString().trim() : '']);

        importCount++;
      } catch (err) {
        console.error('Row insert error:', err);
        errorCount++;
      }
    }

    // Cleanup temp JSON
    fs.unlinkSync(tempJsonPath);

    res.json({
      message: 'Import completed.',
      imported: importCount,
      duplicates: duplicateCount,
      errors: errorCount
    });

  } catch (error) {
    console.error('Import process error:', error);
    if (fs.existsSync(tempJsonPath)) fs.unlinkSync(tempJsonPath);
    res.status(500).json({ error: 'An error occurred during final database import.' });
  }
});

// 7. AI Trigger: Classify Buyer manually
router.post('/:id/classify', async (req, res) => {
  const { id } = req.params;
  try {
    const buyer = await dbGet('SELECT * FROM buyers WHERE id = ?', [id]);
    if (!buyer) return res.status(404).json({ error: 'Buyer not found.' });

    const classification = await classifyBuyer(buyer.company_name, buyer.product_interest);
    res.json(classification);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
