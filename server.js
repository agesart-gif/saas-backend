// server.js

const express = require('express');
const http = require('http');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const swaggerUi = require('swagger-ui-express');
const swaggerDocument = require('./swagger.json');
const jwt = require('jsonwebtoken');
const jobQueue = require('./jobQueue'); // Assume we have a job queue setup
const { chatbot } = require('./chatbot'); // Assume we have a chatbot module
const app = express();

// Middleware
app.use(cors());
app.use(helmet());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Rate limiting middleware
const apiLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100 // limit each IP to 100 requests per windowMs
});
app.use('/api/', apiLimiter);

// Swagger/OpenAPI documentation
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerDocument));

// JWT Authentication middleware
app.use((req, res, next) => {
    const token = req.headers['authorization'] && req.headers['authorization'].split(' ')[1];
    if (token) {
        jwt.verify(token, 'your_jwt_secret', (err, decoded) => {
            if (err) return res.sendStatus(403);
            req.user = decoded;
            next();
        });
    } else {
        res.sendStatus(401);
    }
});

// Chatbot integration
app.post('/api/chat', async (req, res) => {
    try {
        const response = await chatbot.getResponse(req.body.message);
        res.json(response);
    } catch (error) {
        res.status(500).send('Error in chatbot operation');
    }
});

// WhatsApp integration
app.post('/api/whatsapp/send', async (req, res) => {
    // Implementation to send WhatsApp message
});

// Social Media Posting
app.post('/api/social/post', async (req, res) => {
    // Implementation to post on social media
});

// Job Queue
app.post('/api/jobs', (req, res) => {
    // Example job creation
    const job = jobQueue.createJob(req.body);
    res.status(201).send(job);
});

// Error handling
app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(500).send('Something broke!');
});

// Graceful shutdown
const server = http.createServer(app);
process.on('SIGTERM', () => {
    server.close(() => {
        console.log('Server closed');
    });
});

// Start server
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});