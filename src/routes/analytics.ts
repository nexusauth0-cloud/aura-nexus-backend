import { Router, Response } from 'express';
import pool from '../config/database';
import { authMiddleware, AuthRequest } from '../middleware/auth';

const router = Router();

router.use(authMiddleware);

router.get('/dashboard', async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId;

    const tasksResult = await pool.query(
      'SELECT COUNT(*) as total, SUM(CASE WHEN status = $1 THEN 1 ELSE 0 END) as completed FROM tasks WHERE user_id = $2',
      ['completed', userId]
    );

    const notesResult = await pool.query(
      'SELECT COUNT(*) as total FROM notes WHERE user_id = $1',
      [userId]
    );

    const conversationsResult = await pool.query(
      'SELECT COUNT(*) as total FROM conversations WHERE user_id = $1',
      [userId]
    );

    const memoriesResult = await pool.query(
      'SELECT COUNT(*) as total FROM memories WHERE user_id = $1',
      [userId]
    );

    const studyResult = await pool.query(
      'SELECT COUNT(*) as total, AVG(progress) as avg_progress FROM study_materials WHERE user_id = $1',
      [userId]
    );

    const recentTasks = await pool.query(
      'SELECT id, title, priority, status, created_at FROM tasks WHERE user_id = $1 ORDER BY created_at DESC LIMIT 5',
      [userId]
    );

    const recentConversations = await pool.query(
      'SELECT id, title, created_at FROM conversations WHERE user_id = $1 ORDER BY updated_at DESC LIMIT 5',
      [userId]
    );

    res.json({
      stats: {
        tasks: {
          total: parseInt(tasksResult.rows[0]?.total || '0'),
          completed: parseInt(tasksResult.rows[0]?.completed || '0'),
        },
        notes: parseInt(notesResult.rows[0]?.total || '0'),
        conversations: parseInt(conversationsResult.rows[0]?.total || '0'),
        memories: parseInt(memoriesResult.rows[0]?.total || '0'),
        study: {
          total: parseInt(studyResult.rows[0]?.total || '0'),
          avgProgress: Math.round(parseFloat(studyResult.rows[0]?.avg_progress || '0')),
        },
      },
      recentTasks: recentTasks.rows,
      recentConversations: recentConversations.rows,
    });
  } catch (error) {
    console.error('Dashboard analytics error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
