import { Router, Response } from 'express';
import pool from '../config/database';
import { authMiddleware, AuthRequest } from '../middleware/auth';

const router = Router();

router.use(authMiddleware);

router.get('/', async (req: AuthRequest, res: Response) => {
  try {
    const { category } = req.query;
    let query = 'SELECT * FROM memories WHERE user_id = $1';
    const params: any[] = [req.userId];

    if (category) {
      query += ' AND category = $2';
      params.push(category);
    }

    query += ' ORDER BY importance DESC, created_at DESC';

    const result = await pool.query(query, params);
    res.json({ memories: result.rows });
  } catch (error) {
    console.error('Fetch memories error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.post('/', async (req: AuthRequest, res: Response) => {
  try {
    const { category, content, importance } = req.body;
    if (!category || !content) {
      return res.status(400).json({ error: 'Category and content are required' });
    }

    const result = await pool.query(
      'INSERT INTO memories (user_id, category, content, importance) VALUES ($1, $2, $3, $4) RETURNING *',
      [req.userId, category, content, importance || 1]
    );

    res.status(201).json({ memory: result.rows[0] });
  } catch (error) {
    console.error('Create memory error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.put('/:id', async (req: AuthRequest, res: Response) => {
  try {
    const { content, category, importance } = req.body;

    const check = await pool.query(
      'SELECT id FROM memories WHERE id = $1 AND user_id = $2',
      [req.params.id, req.userId]
    );

    if (check.rows.length === 0) {
      return res.status(404).json({ error: 'Memory not found' });
    }

    const updates: string[] = [];
    const values: any[] = [];
    let paramCount = 1;

    if (content !== undefined) { updates.push(`content = $${paramCount++}`); values.push(content); }
    if (category !== undefined) { updates.push(`category = $${paramCount++}`); values.push(category); }
    if (importance !== undefined) { updates.push(`importance = $${paramCount++}`); values.push(importance); }

    updates.push('updated_at = NOW()');
    values.push(req.params.id);

    const result = await pool.query(
      `UPDATE memories SET ${updates.join(', ')} WHERE id = $${paramCount} RETURNING *`,
      values
    );

    res.json({ memory: result.rows[0] });
  } catch (error) {
    console.error('Update memory error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.delete('/:id', async (req: AuthRequest, res: Response) => {
  try {
    const result = await pool.query(
      'DELETE FROM memories WHERE id = $1 AND user_id = $2 RETURNING id',
      [req.params.id, req.userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Memory not found' });
    }

    res.json({ success: true });
  } catch (error) {
    console.error('Delete memory error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
