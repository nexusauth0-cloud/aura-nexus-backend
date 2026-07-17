import { Router, Response } from 'express';
import pool from '../config/database';
import { authMiddleware, AuthRequest } from '../middleware/auth';
import { generateResponse, extractEntities } from '../utils/ai';

const router = Router();

router.use(authMiddleware);

router.get('/', async (req: AuthRequest, res: Response) => {
  try {
    const result = await pool.query(
      'SELECT id, title, messages, created_at, updated_at FROM conversations WHERE user_id = $1 ORDER BY updated_at DESC',
      [req.userId]
    );
    res.json({ conversations: result.rows });
  } catch (error) {
    console.error('Fetch conversations error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.get('/:id', async (req: AuthRequest, res: Response) => {
  try {
    const result = await pool.query(
      'SELECT id, title, messages, model, created_at, updated_at FROM conversations WHERE id = $1 AND user_id = $2',
      [req.params.id, req.userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Conversation not found' });
    }

    res.json({ conversation: result.rows[0] });
  } catch (error) {
    console.error('Fetch conversation error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.post('/', async (req: AuthRequest, res: Response) => {
  try {
    const { title } = req.body;
    const result = await pool.query(
      'INSERT INTO conversations (user_id, title) VALUES ($1, $2) RETURNING id, title, messages, created_at',
      [req.userId, title || 'New Conversation']
    );
    res.status(201).json({ conversation: result.rows[0] });
  } catch (error) {
    console.error('Create conversation error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.post('/:id/messages', async (req: AuthRequest, res: Response) => {
  try {
    const { message } = req.body;
    if (!message) {
      return res.status(400).json({ error: 'Message is required' });
    }

    const convResult = await pool.query(
      'SELECT messages, title FROM conversations WHERE id = $1 AND user_id = $2',
      [req.params.id, req.userId]
    );

    if (convResult.rows.length === 0) {
      return res.status(404).json({ error: 'Conversation not found' });
    }

    const { messages: existingMessages, title } = convResult.rows[0];
    const messages = existingMessages || [];

    messages.push({ role: 'user', content: message, timestamp: new Date().toISOString() });

    const userResult = await pool.query(
      'SELECT preferences FROM users WHERE id = $1',
      [req.userId]
    );

    const context = {
      userId: req.userId!,
      preferences: userResult.rows[0]?.preferences || {},
      conversationHistory: messages,
    };

    const aiResponse = generateResponse(message, context);
    messages.push({ role: 'assistant', content: aiResponse, timestamp: new Date().toISOString() });

    const entities = extractEntities(message);
    let newTitle = title;

    if (messages.length <= 2) {
      newTitle = message.slice(0, 50) + (message.length > 50 ? '...' : '');
    }

    await pool.query(
      'UPDATE conversations SET messages = $1::jsonb, title = $2, updated_at = NOW() WHERE id = $3',
      [JSON.stringify(messages), newTitle, req.params.id]
    );

    if (entities.memories) {
      for (const mem of entities.memories) {
        await pool.query(
          'INSERT INTO memories (user_id, category, content) VALUES ($1, $2, $3)',
          [req.userId, 'conversation', mem.content]
        );
      }
    }

    res.json({
      response: aiResponse,
      messages,
      entities,
    });
  } catch (error) {
    console.error('Send message error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.delete('/:id', async (req: AuthRequest, res: Response) => {
  try {
    await pool.query(
      'DELETE FROM conversations WHERE id = $1 AND user_id = $2',
      [req.params.id, req.userId]
    );
    res.json({ success: true });
  } catch (error) {
    console.error('Delete conversation error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
