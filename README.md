# MahinBook

MahinBook is an installable reading community built with Next.js App Router, Tailwind CSS, and PostgreSQL. Its API runs as Next.js route handlers and is suitable for Vercel serverless hosting.

## Run locally

Requires Node.js 20.9 or newer and a PostgreSQL database.

```sh
npm install
cp .env.example .env.local
# Set DATABASE_URL in .env.local to your PostgreSQL connection string.
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). The first API request creates the required tables and adds the public-domain starter catalogue and sample reader activity. Keep the database URL private.

## Deploy to Vercel

1. Push this project to a GitHub repository.
2. Import that repository in Vercel with the Next.js framework preset.
3. Add `DATABASE_URL` to the Vercel project's Production, Preview, and Development environment variables.
4. Deploy. The API initializes the schema and starter catalogue on its first request.

Use a hosted PostgreSQL provider and its pooled connection string for serverless traffic. Vercel's ephemeral filesystem is not suitable for the SQLite database used by the legacy `app.py` server.

## Features

- Browse and search 32 books by title, author, or genre without an account.
- Create an account, sign in, and keep a personal shelf with To Read, Reading, and Completed statuses.
- Rate and review books, follow readers, like reviews, and comment on them.
- Browse reader profiles, a community feed, and in-app notifications.
- Edit profile details, switch between English and বাংলা, export account data as JSON, or delete an account.
- Install the responsive web app from a supported browser. Its app shell and previously viewed catalogue/shelf data are available offline; changing server-backed data requires a connection.

The starter library and sample reader posts are public demo data. Sample readers are not sign-in accounts. Newly created accounts and social activity are stored in PostgreSQL.

## Data and security

Passwords are hashed with PBKDF2-HMAC-SHA256. Sessions use random server-side tokens stored as hashes and HttpOnly, SameSite cookies. In production cookies are Secure. Keep regular backups of the hosted database.

The old `app.py` HTTP server and its SQLite database are retained for local/legacy use only; the deployed Next.js app does not call them. Existing accounts and activity in `data/mahinbook.sqlite3` are not automatically copied to PostgreSQL. Back up that file before any cleanup or migration.

To import the local database, set the new Neon `DATABASE_URL` in `.env.local`, then run `npm run migrate:sqlite -- data/mahinbook.sqlite3`. The import preserves accounts, books, reviews, shelves, follows, likes, comments, and notifications. Session cookies are not portable, so users will need to sign in again. The importer runs once per target database.

## Project files

- `app/api/[...path]/route.ts` — JSON API routes for books, accounts, shelves, and community activity.
- `lib/db.ts` — PostgreSQL connection, schema initialization, and demo data.
- `lib/catalog.ts` — starter books and sample community data.
- `app/` and `components/` — Next.js routes, layout, and interface.
- `public/` — PWA manifest, icon, and offline app-shell service worker.
- `app.py` — legacy Python HTTP API backed by local SQLite.
- `web/` — original standalone interface retained as a reference.
