import sqlite3 from 'sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const dbPath = path.resolve(__dirname, 'database.sqlite');

const db = new sqlite3.Database(dbPath);

const dbRun = (sql, params = []) => {
  return new Promise((resolve, reject) => {
    db.run(sql, params, function (err) {
      if (err) reject(err);
      else resolve({ id: this.lastID });
    });
  });
};

const seed = async () => {
  console.log('Seeding trial database with sample outreach data...');
  
  try {
    // Enable foreign keys
    await dbRun('PRAGMA foreign_keys = ON');

    // 1. Insert sample template
    const templateName = 'Ve Veyron - Spice Wholesalers Outreach';
    const templateSubject = 'Explore Spice Sourcing Opportunities - Ve Veyron Exports';
    const templateBody = `Dear {{Company_Name}} Team,

I hope you are doing well.

We are Ve Veyron Exports, an Indian spice exporter specializing in high-quality spices.

We supply:
- Turmeric Powder
- Chilli Powder
- Cumin Powder
- Coriander Powder
- Onion Powder
- Garlic Powder

We would like to explore business opportunities with your company.

Please let us know your requirements.

Regards,
Ugam
Ve Veyron Exports`;

    const templateResult = await dbRun(`
      INSERT INTO templates (name, subject, body, created_at)
      VALUES (?, ?, ?, ?)
    `, [templateName, templateSubject, templateBody, new Date().toISOString()]);
    console.log(`Sample template seeded. ID: ${templateResult.id}`);

    // Set as default follow-up templates placeholders too
    await dbRun("UPDATE settings SET value = ? WHERE key = 'followup_1_template_id'", [templateResult.id]);
    await dbRun("UPDATE settings SET value = ? WHERE key = 'followup_2_template_id'", [templateResult.id]);

    // 2. Insert sample buyers (using the ones from your example)
    const buyers = [
      { name: 'ABC Foods', email: 'buyer@abcfoods.com', country: 'United States', interest: 'Turmeric Powder, Cumin Powder' },
      { name: 'XYZ Trading', email: 'info@xyztrading.com', country: 'Germany', interest: 'Chilli Powder, Garlic Powder' },
      { name: 'Global Spices Ltd', email: 'purchase@globalspices.com', country: 'United Kingdom', interest: 'Coriander Powder, Onion Powder' }
    ];

    for (const b of buyers) {
      try {
        await dbRun(`
          INSERT INTO buyers (company_name, email, country, website, product_interest, status, followup_status)
          VALUES (?, ?, ?, ?, ?, 'Imported', 'None')
        `, [b.name, b.email, b.country, `www.${b.name.toLowerCase().replace(/\s+/g, '')}.com`, b.interest]);
        console.log(`Sample buyer seeded: ${b.name}`);
      } catch (err) {
        // Ignored if email already exists
        console.log(`Buyer ${b.name} already exists, skipping.`);
      }
    }

    console.log('Seeding completed successfully!');
  } catch (error) {
    console.error('Error seeding trial data:', error);
  } finally {
    db.close();
  }
};

seed();
