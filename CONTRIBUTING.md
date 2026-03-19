# Contributing to ProfitXIV

Thank you for your interest in contributing. This guide will help you set up the project and understand how to submit changes.

---

## Setting up the project

### 1. Clone the repository

```bash
git clone https://github.com/MRK4/profitxiv.git
cd profitxiv
```

### 2. Install dependencies

```bash
npm install
```

### 3. Configure environment variables

Copy the example env file and fill in the values:

```bash
cp .env.local.example .env.local
```

Edit `.env.local` with:

- **REDIS_URL** — Connection string for Redis (required for market data caching). You can use a local Redis instance or a hosted service.
- **CRON_SECRET** — Optional for local development. The scan route skips auth when the request targets `localhost` or when `NODE_ENV=development`, so you can run `npm run scan:dev:market` without setting it. Required in production (e.g. Vercel Cron).

### 4. Run Redis (local development)

If using local Redis:

```bash
# Using Docker
docker run -d -p 6379:6379 redis:alpine

# Or use your system's Redis if installed
redis-server
```

Set `REDIS_URL` to `redis://localhost:6379` in `.env.local`.

### 5. Start the development server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

### 6. Populate market data (optional)

To see data in the app, trigger a market scan. Ensure the dev server is running, then:

```bash
npm run scan:dev:market
```

This runs the Universalis + XIVAPI scan and stores results in Redis. The first run takes several minutes.

---

## Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Start the Next.js development server with hot-reload. |
| `npm run build` | Create an optimized production build. |
| `npm run start` | Run the production server (requires `npm run build` first). |
| `npm run lint` | Run ESLint to check and lint the code. |
| `npm run scan:dev:market` | Trigger the Universalis market scan manually. Requires the dev server running. `CRON_SECRET` is optional for local dev (the route accepts requests without auth). |
| `npm run scan:market` | Trigger the Universalis market scan manually. Requires the production server running. `CRON_SECRET` is required. |

---

## Opening a Pull Request

Before submitting a PR, please ensure:

1. **Code quality**
   - Run `npm run lint` and fix any reported issues.
   - Run `npm run build` to ensure the project compiles.

2. **Scope**
   - One PR per feature or fix. Keep changes focused and easy to review.
   - If the change is large, consider splitting it into several PRs.

3. **Description**
   - Provide a clear title and description explaining what the PR does and why.
   - Reference any related issues when applicable.

4. **Testing**
   - Test your changes locally (dev server and, if relevant, the market scan).
   - Ensure existing behavior is not broken.

5. **Branch**
   - Create a branch from `main`.
   - Use a descriptive branch name, e.g. `fix/rate-limit-xivapi` or `feat/add-compare-dialog`.

6. **Conventions**
   - Follow the existing code style (ESLint and Prettier if configured).
   - Prefer French for user-facing strings when the app targets French users, or follow the project's language choice.

---

## Thank you for your contribution!