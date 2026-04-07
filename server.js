// server.js — production-ready SaaS backend
import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import pg from 'pg';
import Redis from 'ioredis';
import Bull from 'bull';
import jwt from 'jsonwebtoken';
import axios from 'axios';

const { Pool } = pg;
const app = express();
const PORT = process.env.PORT || 5000;

// ─── Middleware ───────────────────────────────────────────────────────────────
app.use(cors());
app.use(express.json());

// ─── PostgreSQL ───────────────────────────────────────────────────────────────
let pool;
try {
  pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
  });
  pool.on('error', (err) => console.error('[pg] idle client error:', err.message));
  // Verify connectivity at startup
  const client = await pool.connect();
  console.log('[pg] connected to PostgreSQL');
  client.release();
} catch (err) {
  console.error('[pg] connection failed:', err.message);
}

// ─── Redis ────────────────────────────────────────────────────────────────────
let redis;
try {
  redis = new Redis(process.env.REDIS_URL, {
    maxRetriesPerRequest: 3,
    enableReadyCheck: false,
    lazyConnect: true,
  });
  redis.on('connect', () => console.log('[redis] connected'));
  redis.on('error', (err) => console.error('[redis] error:', err.message));
  await redis.connect();
} catch (err) {
  console.error('[redis] connection failed:', err.message);
}

// ─── Bull Queue ───────────────────────────────────────────────────────────────
let postQueue;
try {
  postQueue = new Bull('social-posts', {
    redis: process.env.REDIS_URL,
    defaultJobOptions: {
      attempts: 3,
      backoff: { type: 'exponential', delay: 5000 },
      removeOnComplete: true,
      removeOnFail: false,
    },
  });
  console.log('[bull] social-posts queue ready');
} catch (err) {
  console.error('[bull] queue setup failed:', err.message);
}

// ─── Queue Worker ─────────────────────────────────────────────────────────────
if (postQueue) {
  postQueue.process(async (job) => {
    const { platform, caption, mediaUrl, userId } = job.data;
    console.log(`[worker] processing job ${job.id} — platform: ${platform}`);

    try {
      if (platform === 'instagram') {
        const igUserId = process.env.IG_USER_ID;
        const igToken = process.env.IG_ACCESS_TOKEN;

        // Step 1: create media container
        const containerRes = await axios.post(
          `https://graph.facebook.com/v19.0/${igUserId}/media`,
          { image_url: mediaUrl, caption, access_token: igToken }
        );
        const creationId = containerRes.data.id;

        // Step 2: publish container
        await axios.post(
          `https://graph.facebook.com/v19.0/${igUserId}/media_publish`,
          { creation_id: creationId, access_token: igToken }
        );
        console.log(`[worker] Instagram post published — container: ${creationId}`);

      } else if (platform === 'linkedin') {
        // LinkedIn UGC post (extend with your org URN / access token as needed)
        console.log('[worker] LinkedIn posting not yet configured — skipping');

      } else if (platform === 'youtube') {
        console.log('[worker] YouTube posting not yet configured — skipping');

      } else {
        throw new Error(`Unknown platform: ${platform}`);
      }
    } catch (err) {
      console.error(`[worker] job ${job.id} failed:`, err.message);
      throw err; // re-throw so Bull marks the job as failed and retries
    }
  });

  postQueue.on('completed', (job) => console.log(`[bull] job ${job.id} completed`));
  postQueue.on('failed', (job, err) => console.error(`[bull] job ${job.id} failed:`, err.message));
}

// ─── Helper: require auth ─────────────────────────────────────────────────────
function requireAuth(req, res, next) {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Missing or invalid Authorization header' });
  }
  try {
    req.user = jwt.verify(header.slice(7), process.env.JWT_SECRET);
    next();
  } catch {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
}

// ─── Routes ───────────────────────────────────────────────────────────────────

// GET / — health check
app.get('/', (_req, res) => {
  res.json({
    status: 'ok',
    service: 'saas-backend',
    version: '1.0.0',
    timestamp: new Date().toISOString(),
  });
});

// POST /auth/login — issue a JWT
app.post('/auth/login', async (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) {
    return res.status(400).json({ error: 'username and password are required' });
  }

  try {
    // Look up user in DB (passwords should be hashed in production — bcrypt recommended)
    const result = await pool.query(
      'SELECT id, username, password FROM users WHERE username = $1 LIMIT 1',
      [username]
    );
    const user = result.rows[0];
    if (!user || user.password !== password) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const token = jwt.sign(
      { id: user.id, username: user.username },
      process.env.JWT_SECRET,
      { expiresIn: '7d' }
    );
    return res.json({ token });
  } catch (err) {
    console.error('[/auth/login]', err.message);
    return res.status(500).json({ error: 'Authentication failed' });
  }
});

// POST /api/ai/caption — generate a social-media caption via OpenAI
app.post('/api/ai/caption', requireAuth, async (req, res) => {
  const { prompt, tone = 'professional' } = req.body;
  if (!prompt) {
    return res.status(400).json({ error: 'prompt is required' });
  }

  try {
    const response = await axios.post(
      'https://api.openai.com/v1/chat/completions',
      {
        model: 'gpt-3.5-turbo',
        messages: [
          {
            role: 'system',
            content: `You are a social media copywriter. Write captions that are ${tone}, engaging, and concise.`,
          },
          { role: 'user', content: prompt },
        ],
        max_tokens: 200,
        temperature: 0.7,
      },
      {
        headers: {
          Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
          'Content-Type': 'application/json',
        },
        timeout: 15000,
      }
    );

    const caption = response.data.choices[0].message.content.trim();
    return res.json({ caption });
  } catch (err) {
    console.error('[/api/ai/caption] OpenAI error:', err.message);
    // Graceful fallback so the endpoint never hard-fails
    const fallback = `Check out our latest update! ${prompt.slice(0, 80)}`;
    return res.json({ caption: fallback, fallback: true });
  }
});

// POST /api/leads — capture a lead into the database
app.post('/api/leads', async (req, res) => {
  const { name, phone } = req.body;
  if (!name || !phone) {
    return res.status(400).json({ error: 'name and phone are required' });
  }

  try {
    const result = await pool.query(
      `INSERT INTO leads (name, phone, created_at, updated_at)
       VALUES ($1, $2, NOW(), NOW())
       RETURNING id, name, phone, created_at`,
      [name.trim(), phone.trim()]
    );
    return res.status(201).json({ lead: result.rows[0] });
  } catch (err) {
    console.error('[/api/leads]', err.message);
    return res.status(500).json({ error: 'Failed to save lead' });
  }
});

// POST /api/post/all — enqueue a social-media post job
app.post('/api/post/all', requireAuth, async (req, res) => {
  const { caption, mediaUrl, platforms = ['instagram'] } = req.body;
  if (!caption) {
    return res.status(400).json({ error: 'caption is required' });
  }
  if (!postQueue) {
    return res.status(503).json({ error: 'Queue unavailable — check Redis connection' });
  }

  try {
    const jobs = await Promise.all(
      platforms.map((platform) =>
        postQueue.add({ platform, caption, mediaUrl, userId: req.user.id })
      )
    );
    return res.json({
      message: 'Posts queued successfully',
      jobIds: jobs.map((j) => j.id),
    });
  } catch (err) {
    console.error('[/api/post/all]', err.message);
    return res.status(500).json({ error: 'Failed to queue posts' });
  }
});

// POST /api/whatsapp — WhatsApp chatbot webhook
app.post('/api/whatsapp', async (req, res) => {
  const { message, from } = req.body;
  if (!message || !from) {
    return res.status(400).json({ error: 'message and from are required' });
  }

  let reply = '';
  try {
    const response = await axios.post(
      'https://api.openai.com/v1/chat/completions',
      {
        model: 'gpt-3.5-turbo',
        messages: [
          {
            role: 'system',
            content:
              'You are a helpful WhatsApp assistant for a SaaS business. Be concise and friendly.',
          },
          { role: 'user', content: message },
        ],
        max_tokens: 150,
        temperature: 0.6,
      },
      {
        headers: {
          Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
          'Content-Type': 'application/json',
        },
        timeout: 10000,
      }
    );
    reply = response.data.choices[0].message.content.trim();
  } catch (err) {
    console.error('[/api/whatsapp] AI error:', err.message);
    reply = 'Thanks for your message! Our team will get back to you shortly.';
  }

  // Send reply via WhatsApp Cloud API
  try {
    await axios.post(
      `https://graph.facebook.com/v19.0/${process.env.IG_USER_ID}/messages`,
      {
        messaging_product: 'whatsapp',
        to: from,
        type: 'text',
        text: { body: reply },
      },
      {
        headers: {
          Authorization: `Bearer ${process.env.WHATSAPP_TOKEN}`,
          'Content-Type': 'application/json',
        },
        timeout: 10000,
      }
    );
  } catch (err) {
    console.error('[/api/whatsapp] send error:', err.message);
  }

  return res.json({ reply });
});

// ─── 404 catch-all ────────────────────────────────────────────────────────────
app.use((_req, res) => {
  res.status(404).json({ error: 'Route not found' });
});

// ─── Global error handler ─────────────────────────────────────────────────────
app.use((err, _req, res, _next) => {
  console.error('[unhandled]', err.message);
  res.status(500).json({ error: 'Internal server error' });
});

// ─── Start ────────────────────────────────────────────────────────────────────
const server = app.listen(PORT, () => {
  console.log(`[server] saas-backend listening on port ${PORT} (${process.env.NODE_ENV || 'development'})`);
});

// ─── Graceful shutdown ────────────────────────────────────────────────────────
async function shutdown(signal) {
  console.log(`[server] ${signal} received — shutting down gracefully`);
  server.close(async () => {
    try {
      if (postQueue) await postQueue.close();
      if (redis) await redis.quit();
      if (pool) await pool.end();
      console.log('[server] clean shutdown complete');
    } catch (err) {
      console.error('[server] shutdown error:', err.message);
    }
    process.exit(0);
  });
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
