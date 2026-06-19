# Ingredo

Ingredo is an AI-powered recipe discovery app that helps users turn available ingredients into practical meal ideas, with recipe search, profile features, and guided cooking flows.

## Live Demo

https://ingredo.site

## Tech Stack

- **Frontend:** React 18, TypeScript, Tailwind CSS, shadcn/ui, Framer Motion, Wouter, Zustand, TanStack Query
- **Backend:** Express.js, Drizzle ORM, Neon Postgres, express-session, connect-pg-simple
- **Deployment:** Vercel

## Required Environment Variables

Create environment variables from `.env.example` and set:

- `DATABASE_URL`: Neon/Postgres connection string used by Drizzle, `connect-pg-simple`, and server storage.
- `SESSION_SECRET`: strong random secret for signing session and CSRF cookies.
- `ADMIN_API_KEY`: private key required by admin API routes through the `x-admin-key` header.
- `NVIDIA_API_KEY`: NVIDIA API key for the OpenAI-compatible AI pipeline.

The app also reads these platform/tooling variables:

- `NODE_ENV`: set to `development`, `test`, or `production`; the npm scripts set this for dev/start.
- `PORT`: server listen port; defaults to `5000` when unset.
- `REPL_ID`: optional Replit-only Vite plugin toggle; leave unset outside Replit.

Before deploying, create the session table used by `connect-pg-simple`:

```sql
CREATE TABLE IF NOT EXISTS "user_sessions" (
  "sid" varchar NOT NULL COLLATE "default",
  "sess" json NOT NULL,
  "expire" timestamp(6) NOT NULL
)
WITH (OIDS=FALSE);

ALTER TABLE "user_sessions"
  ADD CONSTRAINT "user_sessions_pkey" PRIMARY KEY ("sid") NOT DEFERRABLE INITIALLY IMMEDIATE;

CREATE INDEX IF NOT EXISTS "IDX_user_sessions_expire" ON "user_sessions" ("expire");
```

Then push the app schema (users, profiles, settings, favorites, pantry items, shopping lists, collections, persisted AI recipes, etc.) with Drizzle:

```bash
npm run db:push
```

Notes:

- The `users` table includes a `role` column (defaults to `user`). To grant a
  user access to the admin dashboard, set their role to `admin` directly in the
  database (`UPDATE users SET role = 'admin' WHERE username = '…';`).
- AI-generated recipes are persisted to a `generated_recipes` table so recipe
  detail pages, favorites, and collections keep working across serverless
  instances.
- The `rate_limit_hits` table used by the shared (cross-instance) rate limiter
  is created automatically on first use; no manual step is required.

## API Surface

Beyond the recipe discovery endpoints, the server persists per-user data through these REST routes (all require an authenticated session):

- `GET/PUT /api/profile` — current user's profile (name, bio, location, website, avatar) plus aggregate stats.
- `GET/PUT /api/settings` — per-user notification/privacy/cooking/accessibility/sync preferences.
- `DELETE /api/auth/account` — irreversibly deletes the account and all related rows.
- `GET /api/favorites`, `POST /api/recipe/:id/save`, `POST /api/recipe/:id/unsave` — favorites.
- `GET/POST/PATCH/DELETE /api/pantry[/:id]` — pantry items.
- `GET/POST/PATCH/DELETE /api/shopping-lists[/:id]` and `…/items[/:itemId]` — shopping lists.
- `GET/POST/PATCH/DELETE /api/profile/collections[/:id]` and `…/recipes[/:recipeId]` — recipe collections.

## Local Setup

1. Install dependencies:

   ```bash
   npm install
   ```

2. Copy env template and fill values:

   ```bash
   cp .env.example .env
   ```

3. Start development server:

   ```bash
   npm run dev
   ```

4. Build for production:

   ```bash
   npm run build
   ```

## Running Tests

Run all tests:

```bash
npm run test:run
```

Type-check:

```bash
npm run check
```
