import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

// Import local services and database
import { initDatabase } from './database.js';
import { startScheduler, processPendingEmails } from './scheduler.js';

// Import API routers
import authRouter from './routes/auth.js';
import buyersRouter from './routes/buyers.js';
import templatesRouter from './routes/templates.js';
import campaignsRouter from './routes/campaigns.js';
import historyRouter from './routes/history.js';
import settingsRouter from './routes/settings.js';
import aiRouter from './routes/ai.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 5000;

// Enable CORS for development frontend
app.use(cors());
app.use(express.json());

// Ensure uploads folder exists
const uploadsDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

// Serve static uploads
app.use('/uploads', express.static(uploadsDir));

// Register API Routes
app.use('/api/auth', authRouter);
app.use('/api/buyers', buyersRouter);
app.use('/api/templates', templatesRouter);
app.use('/api/campaigns', campaignsRouter);
app.use('/api/history', historyRouter);
app.use('/api/settings', settingsRouter);
app.use('/api/ai', aiRouter);

// Endpoint to trigger scheduler manually (useful for serverless environments)
app.post('/api/scheduler/process', async (req, res) => {
  try {
    console.log('Manual scheduler process triggered via API...');
    await processPendingEmails();
    res.json({ message: 'Scheduler run completed successfully.' });
  } catch (error) {
    console.error('Error running scheduler manually:', error);
    res.status(500).json({ error: error.message });
  }
});

// Serve Static Frontend Assets (Vite Production Build)
const frontendBuildPath = path.join(__dirname, 'public');
if (fs.existsSync(frontendBuildPath)) {
  app.use(express.static(frontendBuildPath));
  // Catch-all route to serve Index.html for SPA client-side routing
  app.get('*', (req, res, next) => {
    // If request is for an API route that was not matched above, pass through (returns 404 API error)
    if (req.path.startsWith('/api')) {
      return next();
    }
    res.sendFile(path.join(frontendBuildPath, 'index.html'));
  });
}

// Global Error Handler
app.use((err, req, res, next) => {
  console.error('Unhandled Server Error:', err);
  res.status(500).json({ error: err.message || 'Internal Server Error' });
});

// Initialize database, start scheduler, and start listening
const startServer = async () => {
  console.log('Initializing system...');
  
  // 1. Initialise MongoDB Connection
  await initDatabase();
  
  // 2. Start Background Email Scheduler Loop (checks queue every 60 seconds if persistent host)
  // Only start scheduler if not running on serverless environment (e.g. VERCEL is not set)
  if (!process.env.VERCEL) {
    startScheduler(60000);
  } else {
    console.log('Running in serverless mode. Background scheduler loop disabled (use /api/scheduler/process to trigger).');
  }

  // 3. Start server listener
  app.listen(PORT, () => {
    console.log(`====================================================`);
    console.log(`Ve Veyron Exports Email Sender Server Running`);
    console.log(`Port: ${PORT}`);
    console.log(`Time: ${new Date().toISOString()}`);
    console.log(`====================================================`);
  });
};

startServer().catch((error) => {
  console.error('System start failed:', error);
  process.exit(1);
});

export default app;
