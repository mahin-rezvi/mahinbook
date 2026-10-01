import { randomBytes, pbkdf2Sync } from "node:crypto";
import { Pool } from "pg";
import { books, community, seedReviews, seedShelves } from "./catalog";

let pool: Pool | undefined;
let initialization: Promise<void> | undefined;

export function getPool(): Pool {
  if (!pool) {
    const connectionString = process.env.DATABASE_URL;
    if (!connectionString) {
      throw new Error("DATABASE_URL is not configured.");
    }
    pool = new Pool({ connectionString, max: 2, idleTimeoutMillis: 10_000, connectionTimeoutMillis: 10_000 });
  }
  return pool;
}

async function initializeDatabase(): Promise<void> {
  const client = await getPool().connect();
  try {
    await client.query("BEGIN");
    await client.query("SELECT pg_advisory_xact_lock($1,$2)", [1_347_179_598, 1]);
    await client.query(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      email TEXT NOT NULL UNIQUE,
      password_salt TEXT NOT NULL,
      password_hash TEXT NOT NULL,
      bio TEXT NOT NULL DEFAULT '',
      initials TEXT NOT NULL DEFAULT '',
      color TEXT NOT NULL DEFAULT '#ce795f',
      language TEXT NOT NULL DEFAULT 'en',
      is_seed BOOLEAN NOT NULL DEFAULT FALSE,
      created_at INTEGER NOT NULL
    );
    CREATE TABLE IF NOT EXISTS sessions (
      token_hash TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      expires_at INTEGER NOT NULL
    );
    CREATE TABLE IF NOT EXISTS books (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      author TEXT NOT NULL,
      genre TEXT NOT NULL,
      year INTEGER NOT NULL,
      pages INTEGER NOT NULL,
      summary TEXT NOT NULL,
      color TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS shelves (
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      book_id TEXT NOT NULL REFERENCES books(id) ON DELETE CASCADE,
      status TEXT NOT NULL CHECK (status IN ('To Read', 'Reading', 'Completed')),
      updated_at INTEGER NOT NULL,
      PRIMARY KEY (user_id, book_id)
    );
    CREATE TABLE IF NOT EXISTS reviews (
      id SERIAL PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      book_id TEXT NOT NULL REFERENCES books(id) ON DELETE CASCADE,
      rating INTEGER NOT NULL CHECK (rating BETWEEN 1 AND 5),
      text TEXT NOT NULL,
      created_at INTEGER NOT NULL,
      UNIQUE (user_id, book_id)
    );
    CREATE TABLE IF NOT EXISTS follows (
      follower_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      followee_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      created_at INTEGER NOT NULL,
      PRIMARY KEY (follower_id, followee_id),
      CHECK (follower_id <> followee_id)
    );
    CREATE TABLE IF NOT EXISTS review_likes (
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      review_id INTEGER NOT NULL REFERENCES reviews(id) ON DELETE CASCADE,
      created_at INTEGER NOT NULL,
      PRIMARY KEY (user_id, review_id)
    );
    CREATE TABLE IF NOT EXISTS review_comments (
      id SERIAL PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      review_id INTEGER NOT NULL REFERENCES reviews(id) ON DELETE CASCADE,
      text TEXT NOT NULL,
      created_at INTEGER NOT NULL
    );
    CREATE TABLE IF NOT EXISTS notifications (
      id SERIAL PRIMARY KEY,
      recipient_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      actor_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      kind TEXT NOT NULL,
      entity_id TEXT NOT NULL DEFAULT '',
      created_at INTEGER NOT NULL,
      read_at INTEGER
    );
    CREATE INDEX IF NOT EXISTS review_book_idx ON reviews (book_id, created_at DESC);
    CREATE INDEX IF NOT EXISTS notification_user_idx ON notifications (recipient_id, created_at DESC);
    `);

    for (const book of books) {
      await client.query(
        `INSERT INTO books (id, title, author, genre, year, pages, summary, color)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8) ON CONFLICT (id) DO NOTHING`,
        [...book],
      );
    }

    for (const [id, name, email, bio, initials, color] of community) {
      const salt = randomBytes(16);
      const passwordHash = pbkdf2Sync(randomBytes(32), salt, 240_000, 32, "sha256");
      await client.query(
        `INSERT INTO users
         (id, name, email, password_salt, password_hash, bio, initials, color, is_seed, created_at)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,TRUE,$9) ON CONFLICT (id) DO NOTHING`,
        [id, name, email, salt.toString("hex"), passwordHash.toString("hex"), bio, initials, color, nowSeconds()],
      );
    }

    for (const [index, [userId, bookId, rating, text]] of seedReviews.entries()) {
      await client.query(
        `INSERT INTO reviews (user_id, book_id, rating, text, created_at)
         VALUES ($1,$2,$3,$4,$5) ON CONFLICT (user_id, book_id) DO NOTHING`,
        [userId, bookId, rating, text, nowSeconds() - (seedReviews.length - index) * 86_400],
      );
    }

    for (const [userId, bookId, status] of seedShelves) {
      await client.query(
        `INSERT INTO shelves (user_id, book_id, status, updated_at)
         VALUES ($1,$2,$3,$4) ON CONFLICT (user_id, book_id) DO NOTHING`,
        [userId, bookId, status, nowSeconds()],
      );
    }
    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

export function ensureDatabase(): Promise<void> {
  if (!initialization) {
    initialization = initializeDatabase().catch((error: unknown) => {
      initialization = undefined;
      throw error;
    });
  }
  return initialization;
}

export function nowSeconds(): number {
  return Math.floor(Date.now() / 1000);
}
