const { Pool } = require('pg');

// Database configuration with better error handling
let pool;

function initializePool() {
  if (!process.env.DATABASE_URL) {
    console.error('❌ DATABASE_URL is not set! Please set this environment variable.');
    process.exit(1);
  }

  console.log('🔌 Initializing database connection...');
  console.log('📡 Database host:', new URL(process.env.DATABASE_URL).hostname);
  
  return new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: {
      rejectUnauthorized: false // Required for Render's PostgreSQL
    },
    // Add connection timeout
    connectionTimeoutMillis: 5000,
    idleTimeoutMillis: 30000,
    max: 10
  });
}

// Initialize the pool
pool = initializePool();

// Handle connection errors
pool.on('error', (err) => {
  console.error('❌ Unexpected error on idle client', err);
  process.exit(-1);
});

// Initialize database tables
async function initDB() {
  const client = await pool.connect().catch(err => {
    console.error('❌ Failed to connect to database:', err);
    throw new Error(`Database connection failed: ${err.message}`);
  });

  try {
    console.log('🔄 Creating tables if they do not exist...');
    
    // Create users table if it doesn't exist
    await client.query(`
      CREATE TABLE IF NOT EXISTS users (
        id BIGINT PRIMARY KEY,
        username VARCHAR(255),
        first_name VARCHAR(255),
        last_name VARCHAR(255),
        message_count INTEGER DEFAULT 0,
        sticker_count INTEGER DEFAULT 0,
        last_activity TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    
    console.log('✅ Database initialized successfully');
  } catch (error) {
    console.error('❌ Error initializing database:', error);
    throw error;
  } finally {
    client.release();
  }
}

// User functions
async function getUser(userId) {
  const { rows } = await pool.query('SELECT * FROM users WHERE id = $1', [userId]);
  return rows[0];
}

async function createOrUpdateUser(user) {
  const { id, username, first_name, last_name } = user;
  const query = `
    INSERT INTO users (id, username, first_name, last_name, message_count, sticker_count)
    VALUES ($1, $2, $3, $4, 0, 0)
    ON CONFLICT (id) 
    DO UPDATE SET 
      username = EXCLUDED.username,
      first_name = EXCLUDED.first_name,
      last_name = EXCLUDED.last_name,
      last_activity = CURRENT_TIMESTAMP
    RETURNING *
  `;
  
  const { rows } = await pool.query(query, [id, username, first_name, last_name]);
  return rows[0];
}

async function incrementMessageCount(userId) {
  const { rows } = await pool.query(
    'UPDATE users SET message_count = message_count + 1, last_activity = CURRENT_TIMESTAMP WHERE id = $1 RETURNING *',
    [userId]
  );
  return rows[0];
}

async function incrementStickerCount(userId) {
  const { rows } = await pool.query(
    'UPDATE users SET sticker_count = sticker_count + 1, last_activity = CURRENT_TIMESTAMP WHERE id = $1 RETURNING *',
    [userId]
  );
  return rows[0];
}

async function getLeaderboard(limit = 10) {
  const { rows } = await pool.query(
    `SELECT 
       id, username, first_name, last_name, 
       message_count, sticker_count,
       (message_count + sticker_count) as total_activity
     FROM users 
     ORDER BY total_activity DESC 
     LIMIT $1`,
    [limit]
  );
  
  return rows.map((row, index) => ({
    ...row,
    rank: index + 1,
    total: row.total_activity
  }));
}

module.exports = {
  pool,
  initDB,
  getUser,
  createOrUpdateUser,
  incrementMessageCount,
  incrementStickerCount,
  getLeaderboard
};
