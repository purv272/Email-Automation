import express from 'express';
import { Template, Setting } from '../database.js';
import { authenticateToken } from './auth.js';

const router = express.Router();

router.use(authenticateToken);

// 1. Get all templates
router.get('/', async (req, res) => {
  try {
    const templates = await Template.find().sort({ _id: -1 });
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
    const template = await Template.findById(id);
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
    const newTemplate = await Template.create({
      name,
      subject,
      body,
      created_at: createdAt
    });
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
    const template = await Template.findById(id);
    if (!template) {
      return res.status(404).json({ error: 'Template not found.' });
    }

    const updated = await Template.findByIdAndUpdate(
      id,
      { name, subject, body },
      { new: true }
    );
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
    const f1Referenced = await Setting.findOne({ key: 'followup_1_template_id', value: id });
    const f2Referenced = await Setting.findOne({ key: 'followup_2_template_id', value: id });

    if (f1Referenced || f2Referenced) {
      return res.status(400).json({
        error: 'This template is currently used as a default follow-up template. Please reconfigure settings before deleting.'
      });
    }

    await Template.findByIdAndDelete(id);
    res.json({ message: 'Template deleted successfully.' });
  } catch (error) {
    console.error('Error deleting template:', error);
    res.status(500).json({ error: 'Failed to delete template.' });
  }
});

export default router;
