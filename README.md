# SaaS Backend

A Node.js Express API backend for a SaaS application, built with ES modules and PostgreSQL.

## Requirements

- Node.js 18+
- PostgreSQL

## Getting Started

1. **Clone the repository**

```bash
git clone <repo-url>
cd saas-backend
```

2. **Install dependencies**

```bash
npm install
```

3. **Configure environment variables**

```bash
cp .env.example .env
# Edit .env with your actual values
```

4. **Run database migrations**

```bash
npm run migrate
```

5. **Start the server**

```bash
# Development
npm run dev

# Production
npm start
```

## API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | `/health` | Health check |
| POST | `/chatbot` | AI chatbot (placeholder) |
| POST | `/whatsapp/send` | Send WhatsApp message (placeholder) |
| POST | `/social-media/post` | Post to social media (placeholder) |
| GET | `/api-docs` | Swagger API documentation |

## Environment Variables

See `.env.example` for all required environment variables.

## Deployment

This service is deployed on [Railway](https://railway.app). The `DATABASE_URL` environment variable is automatically injected by Railway when a PostgreSQL plugin is attached.
