// server.js
import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import bodyParser from 'body-parser';
import rateLimit from 'express-rate-limit';

const app = express();
const PORT = process.env.PORT || 3000;

// Security middleware
app.use(helmet());
app.use(cors());

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100,
});
app.use(limiter);

// Logging
app.use(morgan('combined'));

// Body parsing
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// Health check
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'ok', timestamp: new Date().toISOString() });
});

// AI Chatbot endpoint (placeholder)
app.post('/chatbot', async (req, res) => {
  const { message } = req.body;
  if (!message) {
    return res.status(400).json({ error: 'message is required' });
  }
  const aiResponse = `AI response to: ${message}`;
  return res.json({ response: aiResponse });
});

// WhatsApp Integration (placeholder)
app.post('/whatsapp/send', async (req, res) => {
  const { message, to } = req.body;
  if (!message || !to) {
    return res.status(400).json({ error: 'message and to are required' });
  }
  try {
    console.log(`Sending message: "${message}" to WhatsApp number: ${to}`);
    return res.json({ success: true, message: 'Message sent.' });
  } catch (error) {
    return res.status(500).json({ success: false, error: 'Failed to send message.' });
  }
});

// Social Media Posting (placeholder)
app.post('/social-media/post', async (req, res) => {
  const { message, platform } = req.body;
  if (!message || !platform) {
    return res.status(400).json({ error: 'message and platform are required' });
  }
  console.log(`Posting message: "${message}" to ${platform}`);
  return res.json({ success: true, message: 'Post successful.' });
});

// Start server
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});

export default app;
