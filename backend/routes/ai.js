import express from 'express';
import { improveEmail, researchCompany, classifyBuyer } from '../aiService.js';
import { authenticateToken } from './auth.js';

const router = express.Router();

router.use(authenticateToken);

// 1. Refine/Rephrase Template
router.post('/refine', async (req, res) => {
  const { content, instruction } = req.body;

  if (!content || !instruction) {
    return res.status(400).json({ error: 'Content and instruction are required.' });
  }

  try {
    const refined = await improveEmail(content, instruction);
    res.json({ refined });
  } catch (error) {
    console.error('AI Refine error:', error);
    res.status(500).json({ error: error.message });
  }
});

// 2. Research Company
router.post('/research', async (req, res) => {
  const { companyName } = req.body;

  if (!companyName) {
    return res.status(400).json({ error: 'Company Name is required.' });
  }

  try {
    const analysis = await researchCompany(companyName);
    res.json(analysis);
  } catch (error) {
    console.error('AI Research error:', error);
    res.status(500).json({ error: error.message });
  }
});

// 3. Classify Buyer
router.post('/classify', async (req, res) => {
  const { companyName, productInterest } = req.body;

  if (!companyName) {
    return res.status(400).json({ error: 'Company Name is required.' });
  }

  try {
    const result = await classifyBuyer(companyName, productInterest);
    res.json(result);
  } catch (error) {
    console.error('AI Classification error:', error);
    res.status(500).json({ error: error.message });
  }
});

export default router;
