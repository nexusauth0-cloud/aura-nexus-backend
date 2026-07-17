import pool from './database';

const seed = async () => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    await client.query(`
      INSERT INTO users (username, email, password_hash, preferences)
      VALUES ('demouser', 'demo@auranexus.ai', '$2a$10$dummy_hash_for_demo', '{"theme": "dark", "voice_enabled": true, "language": "en"}')
      ON CONFLICT (email) DO NOTHING;
    `);

    await client.query('COMMIT');
    console.log('✅ Seed completed successfully');
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('❌ Seed failed:', error);
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
};

seed();
