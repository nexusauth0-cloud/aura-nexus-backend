import dotenv from 'dotenv';
dotenv.config();

import express from 'express';
import cors from 'cors';
import pool from './config/database';
import authRoutes from './routes/auth';
import conversationRoutes from './routes/conversations';
import taskRoutes from './routes/tasks';
import noteRoutes from './routes/notes';
import memoryRoutes from './routes/memories';
import studyRoutes from './routes/study';
import plannerRoutes from './routes/planner';
import analyticsRoutes from './routes/analytics';

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:5173',
  credentials: true,
}));
app.use(express.json({ limit: '10mb' }));

app.get('/api/health', async (_req, res) => {
  let dbStatus = 'disconnected';
  try {
    await pool.query('SELECT 1');
    dbStatus = 'connected';
  } catch {}
  res.json({ status: 'ok', service: 'aura-nexus-api', version: '1.0.0', database: dbStatus });
});

app.use('/api/auth', authRoutes);
app.use('/api/conversations', conversationRoutes);
app.use('/api/tasks', taskRoutes);
app.use('/api/notes', noteRoutes);
app.use('/api/memories', memoryRoutes);
app.use('/api/study', studyRoutes);
app.use('/api/planner', plannerRoutes);
app.use('/api/analytics', analyticsRoutes);

app.use((err: any, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error('Unhandled error:', err);
  res.status(500).json({ error: 'Internal server error' });
});

async function start() {
  try {
    await pool.query('SELECT 1');
    console.log('  ✓ PostgreSQL connected');
  } catch (err: any) {
    console.log('  ⚠ PostgreSQL unavailable — API will start but DB routes will fail');
    console.log(`    ${err.message}`);
  }

  app.listen(PORT, () => {
    console.log(`\n  🚀 Aura Nexus API running on http://localhost:${PORT}\n`);
  });
}

start();

export default app;
