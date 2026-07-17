import { Router, Response } from 'express';
import pool from '../config/database';
import { authMiddleware, AuthRequest } from '../middleware/auth';

const router = Router();

router.use(authMiddleware);

router.get('/', async (req: AuthRequest, res: Response) => {
  try {
    const result = await pool.query(
      'SELECT * FROM study_materials WHERE user_id = $1 ORDER BY created_at DESC',
      [req.userId]
    );
    res.json({ materials: result.rows });
  } catch (error) {
    console.error('Fetch study materials error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.post('/', async (req: AuthRequest, res: Response) => {
  try {
    const { title, content, summary, category } = req.body;
    if (!title) {
      return res.status(400).json({ error: 'Title is required' });
    }

    const result = await pool.query(
      'INSERT INTO study_materials (user_id, title, content, summary, category) VALUES ($1, $2, $3, $4, $5) RETURNING *',
      [req.userId, title, content || '', summary || '', category || 'general']
    );

    res.status(201).json({ material: result.rows[0] });
  } catch (error) {
    console.error('Create study material error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.post('/:id/summarize', async (req: AuthRequest, res: Response) => {
  try {
    const result = await pool.query(
      'SELECT content, summary FROM study_materials WHERE id = $1 AND user_id = $2',
      [req.params.id, req.userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Study material not found' });
    }

    const { content } = result.rows[0];
    const sentences = content.split(/[.!?]+/).filter(Boolean);
    const summary = sentences.slice(0, Math.min(5, sentences.length)).join('. ') + '.';

    await pool.query(
      'UPDATE study_materials SET summary = $1, updated_at = NOW() WHERE id = $2',
      [summary, req.params.id]
    );

    res.json({ summary });
  } catch (error) {
    console.error('Summarize error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.post('/:id/quiz', async (req: AuthRequest, res: Response) => {
  try {
    const result = await pool.query(
      'SELECT content, quizzes FROM study_materials WHERE id = $1 AND user_id = $2',
      [req.params.id, req.userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Study material not found' });
    }

    const { content, quizzes: existingQuizzes } = result.rows[0];
    const sentences = content.split(/[.!?]+/).filter(Boolean);

    const quizzes = existingQuizzes || [];
    if (sentences.length >= 3) {
      const newQuiz = {
        id: quizzes.length + 1,
        question: `Based on the material: "${sentences[0].trim()}"`,
        options: [
          sentences[0].trim(),
          sentences[1]?.trim() || 'Alternative answer',
          sentences[2]?.trim() || 'Another option',
          'None of the above',
        ],
        correct: 0,
        created_at: new Date().toISOString(),
      };
      quizzes.push(newQuiz);
    }

    await pool.query(
      'UPDATE study_materials SET quizzes = $1::jsonb, updated_at = NOW() WHERE id = $2',
      [JSON.stringify(quizzes), req.params.id]
    );

    res.json({ quizzes });
  } catch (error) {
    console.error('Generate quiz error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.post('/:id/flashcards', async (req: AuthRequest, res: Response) => {
  try {
    const result = await pool.query(
      'SELECT content, flashcards FROM study_materials WHERE id = $1 AND user_id = $2',
      [req.params.id, req.userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Study material not found' });
    }

    const { content, flashcards: existingFlashcards } = result.rows[0];
    const sentences = content.split(/[.!?]+/).filter(Boolean);

    const flashcards = existingFlashcards || [];
    for (let i = 0; i < Math.min(3, sentences.length); i++) {
      const words = sentences[i].split(' ');
      if (words.length > 3) {
        const answer = words.slice(-3).join(' ');
        const question = words.slice(0, -3).join(' ') + ' ___';
        flashcards.push({
          id: flashcards.length + 1,
          question: question.trim(),
          answer: answer.trim(),
          created_at: new Date().toISOString(),
        });
      }
    }

    await pool.query(
      'UPDATE study_materials SET flashcards = $1::jsonb, updated_at = NOW() WHERE id = $2',
      [JSON.stringify(flashcards), req.params.id]
    );

    res.json({ flashcards });
  } catch (error) {
    console.error('Generate flashcards error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.put('/:id/progress', async (req: AuthRequest, res: Response) => {
  try {
    const { progress } = req.body;
    const result = await pool.query(
      'UPDATE study_materials SET progress = $1, updated_at = NOW() WHERE id = $2 AND user_id = $3 RETURNING *',
      [progress, req.params.id, req.userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Study material not found' });
    }

    res.json({ material: result.rows[0] });
  } catch (error) {
    console.error('Update progress error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.delete('/:id', async (req: AuthRequest, res: Response) => {
  try {
    const result = await pool.query(
      'DELETE FROM study_materials WHERE id = $1 AND user_id = $2 RETURNING id',
      [req.params.id, req.userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Study material not found' });
    }

    res.json({ success: true });
  } catch (error) {
    console.error('Delete study material error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
