import sqlite3 from 'sqlite3';
import bcrypt from 'bcryptjs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const dbPath = path.resolve(__dirname, 'database.sqlite');
const db = new sqlite3.Database(dbPath, (err) => {
  if (err) {
    console.error('Error opening database:', err.message);
  } else {
    console.log('Connected to the SQLite database.');
  }
});

// Promisify database actions for modern async/await syntax
export const dbQuery = (sql, params = []) => {
  return new Promise((resolve, reject) => {
    db.all(sql, params, (err, rows) => {
      if (err) reject(err);
      else resolve(rows);
    });
  });
};

export const dbGet = (sql, params = []) => {
  return new Promise((resolve, reject) => {
    db.get(sql, params, (err, row) => {
      if (err) reject(err);
      else resolve(row);
    });
  });
};

export const dbRun = (sql, params = []) => {
  return new Promise((resolve, reject) => {
    db.run(sql, params, function (err) {
      if (err) reject(err);
      else resolve({ id: this.lastID, changes: this.changes });
    });
  });
};

// Database Initialization
export const initDatabase = async () => {
  try {
    // 1. Users table
    await dbRun(`
      CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        username TEXT UNIQUE NOT NULL,
        password TEXT NOT NULL
      )
    `);

    // 2. Settings table
    await dbRun(`
      CREATE TABLE IF NOT EXISTS settings (
        key TEXT PRIMARY KEY,
        value TEXT
      )
    `);

    // 3. Buyers table
    await dbRun(`
      CREATE TABLE IF NOT EXISTS buyers (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        company_name TEXT NOT NULL,
        email TEXT UNIQUE NOT NULL,
        country TEXT,
        website TEXT,
        product_interest TEXT,
        status TEXT DEFAULT 'Imported',
        date_sent TEXT,
        followup_status TEXT DEFAULT 'None'
      )
    `);

    // 4. Templates table
    await dbRun(`
      CREATE TABLE IF NOT EXISTS templates (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        subject TEXT NOT NULL,
        body TEXT NOT NULL,
        created_at TEXT NOT NULL
      )
    `);

    // 5. Campaigns table
    await dbRun(`
      CREATE TABLE IF NOT EXISTS campaigns (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        template_id INTEGER,
        status TEXT DEFAULT 'Draft',
        attachments TEXT DEFAULT '[]',
        created_at TEXT NOT NULL,
        FOREIGN KEY (template_id) REFERENCES templates(id)
      )
    `);

    // 6. Campaign Buyers relation table
    await dbRun(`
      CREATE TABLE IF NOT EXISTS campaign_buyers (
        campaign_id INTEGER,
        buyer_id INTEGER,
        status TEXT DEFAULT 'Pending',
        sent_at TEXT,
        error_message TEXT,
        custom_subject TEXT,
        custom_body TEXT,
        followup_1_date TEXT,
        followup_1_status TEXT DEFAULT 'Pending',
        followup_2_date TEXT,
        followup_2_status TEXT DEFAULT 'Pending',
        PRIMARY KEY (campaign_id, buyer_id),
        FOREIGN KEY (campaign_id) REFERENCES campaigns(id) ON DELETE CASCADE,
        FOREIGN KEY (buyer_id) REFERENCES buyers(id) ON DELETE CASCADE
      )
    `);

    // 7. Sent History table
    await dbRun(`
      CREATE TABLE IF NOT EXISTS sent_history (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        buyer_id INTEGER,
        campaign_id INTEGER,
        email_address TEXT NOT NULL,
        company_name TEXT NOT NULL,
        subject TEXT NOT NULL,
        body TEXT NOT NULL,
        type TEXT NOT NULL,
        sent_at TEXT NOT NULL,
        status TEXT NOT NULL,
        error_message TEXT
      )
    `);

    // Setup Default Admin User
    const adminExists = await dbGet('SELECT * FROM users WHERE username = ?', ['admin']);
    if (!adminExists) {
      const salt = await bcrypt.genSalt(10);
      const hashedPassword = await bcrypt.hash('admin123', salt);
      await dbRun('INSERT INTO users (username, password) VALUES (?, ?)', ['admin', hashedPassword]);
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
      const settingExists = await dbGet('SELECT * FROM settings WHERE key = ?', [key]);
      if (!settingExists) {
        await dbRun('INSERT INTO settings (key, value) VALUES (?, ?)', [key, val]);
      }
    }
    console.log('Default settings checks completed.');

  } catch (error) {
    console.error('Database initialization failed:', error);
  }
};

export default db;
