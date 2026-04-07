# saas-backend

Production-ready Node.js / Express API for a SaaS platform. Integrates PostgreSQL, Redis, Bull queues, OpenAI, WhatsApp Cloud API, and the Instagram Graph API.

---

## Stack

| Layer      | Technology                        |
|------------|-----------------------------------|
| Runtime    | Node.js 20 (ES modules)           |
| Framework  | Express 4                         |
| Database   | PostgreSQL (via `pg`)             |
| Cache/Queue| Redis + Bull                      |
| AI         | OpenAI GPT-3.5-turbo              |
| Messaging  | WhatsApp Cloud API                |
| Social     | Instagram Graph API v19           |
| Auth       | JSON Web Tokens (`jsonwebtoken`)  |

---

## Local setup

```bash
# 1. Install dependencies
npm install

# 2. Copy the environment template and fill in your values
cp .env.example .env

# 3. Run database migrations (requires psql or any Postgres client)
psql "$DATABASE_URL" -f migrations/001_init.sql
psql "$DATABASE_URL" -f migrations/002_add_api_keys_table.sql
psql "$DATABASE_URL" -f migrations/003_create_leads_table.sql

# 4. Start the dev server (auto-restarts on file changes)
npm run dev

# 5. Or start in production mode
npm start
```

---

## Environment variables

| Variable          | Required | Description                                      |
|-------------------|----------|--------------------------------------------------|
| `PORT`            | No       | HTTP port (default: 5000)                        |
| `NODE_ENV`        | No       | `production` enables SSL for Postgres            |
| `DATABASE_URL`    | Yes      | PostgreSQL connection string                     |
| `REDIS_URL`       | Yes      | Redis connection string                          |
| `JWT_SECRET`      | Yes      | Secret used to sign/verify JWTs                  |
| `OPENAI_API_KEY`  | Yes      | OpenAI API key                                   |
| `WHATSAPP_TOKEN`  | Yes      | WhatsApp Cloud API bearer token                  |
| `IG_USER_ID`      | Yes      | Instagram Business account user ID               |
| `IG_ACCESS_TOKEN` | Yes      | Instagram Graph API long-lived access token      |

---

## API endpoints

### `GET /`
Health check.

```bash
curl https://your-app.railway.app/
# {"status":"ok","service":"saas-backend","version":"1.0.0","timestamp":"..."}
```

---

### `POST /auth/login`
Returns a signed JWT.

```bash
curl -X POST https://your-app.railway.app/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"secret"}'
# {"token":"eyJ..."}
```

---

### `POST /api/ai/caption` *(requires auth)*
Generate a social-media caption via OpenAI.

```bash
curl -X POST https://your-app.railway.app/api/ai/caption \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{"prompt":"New product launch for eco-friendly water bottles","tone":"excited"}'
# {"caption":"..."}
```

---

### `POST /api/leads`
Capture a lead (no auth required — public form endpoint).

```bash
curl -X POST https://your-app.railway.app/api/leads \
  -H "Content-Type: application/json" \
  -d '{"name":"Jane Doe","phone":"+1234567890"}'
# {"lead":{"id":1,"name":"Jane Doe","phone":"+1234567890","created_at":"..."}}
```

---

### `POST /api/post/all` *(requires auth)*
Enqueue a social-media post to one or more platforms.

```bash
curl -X POST https://your-app.railway.app/api/post/all \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{"caption":"Hello world!","mediaUrl":"https://example.com/image.jpg","platforms":["instagram"]}'
# {"message":"Posts queued successfully","jobIds":["1"]}
```

---

### `POST /api/whatsapp`
WhatsApp chatbot webhook — receives a message, generates an AI reply, and sends it back.

```bash
curl -X POST https://your-app.railway.app/api/whatsapp \
  -H "Content-Type: application/json" \
  -d '{"message":"What are your business hours?","from":"+1234567890"}'
# {"reply":"..."}
```

---

## Database schema

### leads

```sql
CREATE TABLE IF NOT EXISTS leads (
    id          SERIAL PRIMARY KEY,
    name        VARCHAR(255) NOT NULL,
    phone       VARCHAR(50)  NOT NULL,
    email       VARCHAR(255),
    source      VARCHAR(100),
    created_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    updated_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);
```

See `migrations/` for the full schema including `users`, `conversations`, `messages`, `social_posts`, and `api_keys`.

---

## Deploying to Railway

1. Push this repo to GitHub.
2. In Railway, create a new project → **Deploy from GitHub repo**.
3. Add a **PostgreSQL** plugin and a **Redis** plugin — Railway injects `DATABASE_URL` and `REDIS_URL` automatically.
4. Set the remaining environment variables (`JWT_SECRET`, `OPENAI_API_KEY`, etc.) in **Variables**.
5. Railway detects Node.js via `package.json` and runs `npm start` automatically.
6. Run migrations once via the Railway shell or a one-off job:
   ```bash
   psql "$DATABASE_URL" -f migrations/001_init.sql
   psql "$DATABASE_URL" -f migrations/002_add_api_keys_table.sql
   psql "$DATABASE_URL" -f migrations/003_create_leads_table.sql
   ```

---

## Troubleshooting

| Symptom | Likely cause | Fix |
|---------|-------------|-----|
| `npm not found` (exit 127) | Corrupted `package.json` prevented dependency install | Ensure `package.json` is valid JSON (no escape characters, no trailing commas) |
| `hujson: invalid escape character` | Backslash in a JSON string value | Remove or double-escape the backslash |
| `Cannot find package 'express'` | `node_modules` not installed | Confirm build step runs `npm install` |
| `pg: connection failed` | Wrong `DATABASE_URL` | Check Railway → Variables tab |
| `redis: connection failed` | Wrong `REDIS_URL` | Check Railway → Variables tab |
| JWT `invalid signature` | `JWT_SECRET` mismatch between envs | Use the same secret in all environments |
