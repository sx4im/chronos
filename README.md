# Ingredo

Ingredo is an AI-powered recipe discovery app that helps users turn available ingredients into practical meal ideas, with recipe search, profile features, and guided cooking flows.

## Live Demo

https://ingredo.site

## Tech Stack

- **Frontend:** React 18, TypeScript, Tailwind CSS, shadcn/ui, Framer Motion, Wouter, Zustand, TanStack Query
- **Backend:** Express.js, Drizzle ORM, Neon Postgres, express-session, connect-pg-simple
- **Deployment:** Vercel

## Required Environment Variables

Create a `.env` file from `.env.example` and set:

- `DATABASE_URL`
- `SESSION_SECRET`
- `ADMIN_API_KEY`
- `VITE_API_BASE_URL`
- `OPENAI_API_KEY`

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
