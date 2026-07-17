import { Router, Response } from 'express';
import pool from '../config/database';
import { authMiddleware, AuthRequest } from '../middleware/auth';

const router = Router();

router.use(authMiddleware);

router.get('/', async (req: AuthRequest, res: Response) => {
  try {
    const { date } = req.query;
    let query = 'SELECT * FROM daily_plans WHERE user_id = $1';
    const params: any[] = [req.userId];

    if (date) {
      query += ' AND date = $2';
      params.push(date);
    }

    query += ' ORDER BY date DESC LIMIT 30';

    const result = await pool.query(query, params);
    res.json({ plans: result.rows });
  } catch (error) {
    console.error('Fetch plans error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.post('/', async (req: AuthRequest, res: Response) => {
  try {
    const { date, plan } = req.body;

    if (!date) {
      return res.status(400).json({ error: 'Date is required' });
    }

    const existing = await pool.query(
      'SELECT id FROM daily_plans WHERE user_id = $1 AND date = $2',
      [req.userId, date]
    );

    if (existing.rows.length > 0) {
      const result = await pool.query(
        'UPDATE daily_plans SET plan = $1::jsonb, updated_at = NOW() WHERE id = $2 RETURNING *',
        [JSON.stringify(plan || {}), existing.rows[0].id]
      );
      return res.json({ plan: result.rows[0] });
    }

    const result = await pool.query(
      'INSERT INTO daily_plans (user_id, date, plan) VALUES ($1, $2, $3::jsonb) RETURNING *',
      [req.userId, date, JSON.stringify(plan || {})]
    );

    res.status(201).json({ plan: result.rows[0] });
  } catch (error) {
    console.error('Create plan error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.post('/generate', async (req: AuthRequest, res: Response) => {
  try {
    const { date } = req.body;
    const targetDate = date || new Date().toISOString().split('T')[0];

    const tasksResult = await pool.query(
      'SELECT title, priority FROM tasks WHERE user_id = $1 AND status = $2 ORDER BY priority DESC LIMIT 5',
      [req.userId, 'pending']
    );

    const tasks = tasksResult.rows;
    const hours = ['09:00', '10:00', '11:00', '12:00', '13:00', '14:00', '15:00', '16:00', '17:00'];

    const plan = {
      focus_sessions: 3,
      tasks_planned: tasks.map((t: any, i: number) => ({
        time: hours[i] || 'flexible',
        task: t.title,
        priority: t.priority,
      })),
      goals: [
        'Complete priority tasks',
        'Take regular breaks',
        'Review daily progress',
      ],
      breaks: [
        { time: '10:30', duration: '15m' },
        { time: '12:30', duration: '45m' },
        { time: '15:00', duration: '15m' },
      ],
    };

    const existing = await pool.query(
      'SELECT id FROM daily_plans WHERE user_id = $1 AND date = $2',
      [req.userId, targetDate]
    );

    let result;
    if (existing.rows.length > 0) {
      result = await pool.query(
        'UPDATE daily_plans SET plan = $1::jsonb, completed = false, updated_at = NOW() WHERE id = $2 RETURNING *',
        [JSON.stringify(plan), existing.rows[0].id]
      );
    } else {
      result = await pool.query(
        'INSERT INTO daily_plans (user_id, date, plan) VALUES ($1, $2, $3::jsonb) RETURNING *',
        [req.userId, targetDate, JSON.stringify(plan)]
      );
    }

    res.json({ plan: result.rows[0] });
  } catch (error) {
    console.error('Generate plan error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.put('/:id', async (req: AuthRequest, res: Response) => {
  try {
    const { plan, focus_sessions, completed } = req.body;

    const updates: string[] = [];
    const values: any[] = [];
    let paramCount = 1;

    if (plan !== undefined) { updates.push(`plan = $${paramCount++}::jsonb`); values.push(JSON.stringify(plan)); }
    if (focus_sessions !== undefined) { updates.push(`focus_sessions = $${paramCount++}`); values.push(focus_sessions); }
    if (completed !== undefined) { updates.push(`completed = $${paramCount++}`); values.push(completed); }

    updates.push('updated_at = NOW()');
    values.push(req.params.id);

    const result = await pool.query(
      `UPDATE daily_plans SET ${updates.join(', ')} WHERE id = $${paramCount} AND user_id = $${paramCount + 1} RETURNING *`,
      [...values, req.userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Plan not found' });
    }

    res.json({ plan: result.rows[0] });
  } catch (error) {
    console.error('Update plan error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
