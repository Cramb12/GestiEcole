// Entry point — Express API for the DRC School Operations System.
import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';

import { testConnection } from './config/db.js';
import authRoutes from './routes/authRoutes.js';
import dashboardRoutes from './routes/dashboardRoutes.js';
import { notFound, errorHandler } from './middleware/errorHandler.js';

dotenv.config();

const app = express();

app.use(cors({ origin: process.env.CLIENT_URL || '*' }));
app.use(express.json());

// Root + health check (so the base URL doesn't look broken on Render).
app.get('/', (req, res) => {
  res.json({ service: 'GestiEcole API', status: 'ok', docs: '/api/health' });
});
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', message: 'API en ligne' });
});

// Routes.
app.use('/api/auth', authRoutes);
app.use('/api/dashboard', dashboardRoutes);

// 404 + error handling.
app.use(notFound);
app.use(errorHandler);

const PORT = process.env.PORT || 5000;

app.listen(PORT, async () => {
  console.log(`🚀 Serveur démarré sur http://localhost:${PORT}`);
  await testConnection();
});
