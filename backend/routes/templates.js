import express from 'express';
import { dbQuery, dbGet, dbRun } from '../database.js';
import { authenticateToken } from './auth.js';

const router = express.Router();

router.use(authenticateToken);

// 1. Get all templates
router.get('/', async (req, res) => {
  try {
    const templates = await dbQuery('SELECT * FROM templates ORDER BY id DESC');
    res.json(templates);
  } catch (error) {
    console.error('Error fetching templates:', error);
    res.status(500).json({ error: 'Failed to fetch templates.' });
  }
});

// 2. Get single template
router.get('/:id', async (req, res) => {
  const { id } = req.params;
  try {
    const template = await dbGet('SELECT * FROM templates WHERE id = ?', [id]);
    if (!template) {
      return res.status(404).json({ error: 'Template not found.' });
    }
    res.json(template);
  } catch (error) {
    console.error('Error fetching template:', error);
    res.status(500).json({ error: 'Failed to fetch template.' });
  }
});

// 3. Create template
router.post('/', async (req, res) => {
  const { name, subject, body } = req.body;

  if (!name || !subject || !body) {
    return res.status(400).json({ error: 'Name, Subject, and Body are required.' });
  }

  const createdAt = new Date().toISOString();

  try {
    const result = await dbRun(
      'INSERT INTO templates (name, subject, body, created_at) VALUES (?, ?, ?, ?)',
      [name, subject, body, createdAt]
    );
    const newTemplate = await dbGet('SELECT * FROM templates WHERE id = ?', [result.id]);
    res.status(201).json(newTemplate);
  } catch (error) {
    console.error('Error creating template:', error);
    res.status(500).json({ error: 'Failed to create template.' });
  }
});

// 4. Update template
router.put('/:id', async (req, res) => {
  const { id } = req.params;
  const { name, subject, body } = req.body;

  if (!name || !subject || !body) {
    return res.status(400).json({ error: 'Name, Subject, and Body are required.' });
  }

  try {
    const template = await dbGet('SELECT * FROM templates WHERE id = ?', [id]);
    if (!template) {
      return res.status(404).json({ error: 'Template not found.' });
    }

    await dbRun(
      'UPDATE templates SET name = ?, subject = ?, body = ? WHERE id = ?',
      [name, subject, body, id]
    );

    const updated = await dbGet('SELECT * FROM templates WHERE id = ?', [id]);
    res.json(updated);
  } catch (error) {
    console.error('Error updating template:', error);
    res.status(500).json({ error: 'Failed to update template.' });
  }
});

// 5. Delete template
router.delete('/:id', async (req, res) => {
  const { id } = req.params;
  try {
    // Check if this template is referenced as a follow-up template in Settings
    const f1Referenced = await dbGet("SELECT * FROM settings WHERE key = 'followup_1_template_id' AND value = ?", [id]);
    const f2Referenced = await dbGet("SELECT * FROM settings WHERE key = 'followup_2_template_id' AND value = ?", [id]);

    if (f1Referenced || f2Referenced) {
      return res.status(400).json({
        error: 'This template is currently used as a default follow-up template. Please reconfigure settings before deleting.'
      });
    }

    await dbRun('DELETE FROM templates WHERE id = ?', [id]);
    res.json({ message: 'Template deleted successfully.' });
  } catch (error) {
    console.error('Error deleting template:', error);
    res.status(500).json({ error: 'Failed to delete template.' });
  }
});

export default router;
