import { spawn } from "node:child_process";
import path from "node:path";
import type { PoolClient } from "pg";
import { loadEnvConfig } from "@next/env";
import { ensureDatabase, getPool, nowSeconds } from "../lib/db";

type LegacyRow = Record<string, string | number | null>;
type LegacyData = Record<string, LegacyRow[]>;

const extractor = `
import json, sqlite3, sys
db = sqlite3.connect(sys.argv[1])
db.row_factory = sqlite3.Row
tables = ("users", "books", "shelves", "reviews", "follows", "review_likes", "review_comments", "notifications")
print(json.dumps({name: [dict(row) for row in db.execute("SELECT * FROM " + name)] for name in tables}, separators=(",", ":")))
`;

function extractSqliteData(databasePath: string): Promise<LegacyData> {
  return new Promise((resolve, reject) => {
    const child = spawn(process.env.PYTHON || "python3", ["-c", extractor, databasePath], {
      stdio: ["ignore", "pipe", "pipe"],
    });
    let output = "";
    let errorOutput = "";
    child.stdout.setEncoding("utf8");
    child.stderr.setEncoding("utf8");
    child.stdout.on("data", (chunk: string) => {
      output += chunk;
    });
    child.stderr.on("data", (chunk: string) => {
      errorOutput += chunk;
    });
    child.on("error", reject);
    child.on("close", (code) => {
      if (code !== 0) {
        reject(new Error(`Could not read the SQLite database: ${errorOutput.trim()}`));
        return;
      }
      try {
        resolve(JSON.parse(output) as LegacyData);
      } catch (error) {
        reject(new Error("Could not parse the SQLite export.", { cause: error }));
      }
    });
  });
}

async function importRows(
  client: PoolClient,
  rows: LegacyRow[],
  table: string,
  columns: string[],
  conflictColumns: string[] = [],
  updateColumns: string[] = [],
): Promise<void> {
  const names = columns.join(",");
  const placeholders = columns.map((_, index) => `$${index + 1}`).join(",");
  const conflict = conflictColumns.length
    ? `ON CONFLICT (${conflictColumns.join(",")}) ${
        updateColumns.length
          ? `DO UPDATE SET ${updateColumns.map((column) => `${column}=EXCLUDED.${column}`).join(",")}`
          : "DO NOTHING"
      }`
    : "ON CONFLICT DO NOTHING";
  for (const row of rows) {
    const values = columns.map((column) => row[column] ?? null);
    await client.query(`INSERT INTO ${table} (${names}) VALUES (${placeholders}) ${conflict}`, values);
  }
}

async function main(): Promise<void> {
  loadEnvConfig(process.cwd());
  const databasePath = path.resolve(process.argv[2] || "data/mahinbook.sqlite3");
  if (!process.env.DATABASE_URL) {
    throw new Error("Set DATABASE_URL to the new hosted PostgreSQL database before migrating.");
  }
  const legacyData = await extractSqliteData(databasePath);
  await ensureDatabase();
  const sourceKey = "local-sqlite-v1";
  const client = await getPool().connect();
  try {
    await client.query("BEGIN");
    await client.query("SELECT pg_advisory_xact_lock($1,$2)", [1_347_179_598, 2]);
    await client.query(`
      CREATE TABLE IF NOT EXISTS sqlite_imports (
        source_hash TEXT PRIMARY KEY,
        imported_at INTEGER NOT NULL
      )
    `);
    const alreadyImported = await client.query(
      "SELECT 1 FROM sqlite_imports WHERE source_hash=$1",
      [sourceKey],
    );
    if (alreadyImported.rows.length > 0) {
      await client.query("ROLLBACK");
      console.log("This SQLite database has already been imported.");
      return;
    }

    await importRows(client, legacyData.books, "books", [
      "id", "title", "author", "genre", "year", "pages", "summary", "color",
    ], ["id"], ["title", "author", "genre", "year", "pages", "summary", "color"]);
    await importRows(client, legacyData.users, "users", [
      "id", "name", "email", "password_salt", "password_hash", "bio", "initials",
      "color", "language", "is_seed", "created_at",
    ], ["id"], [
      "name", "email", "password_salt", "password_hash", "bio", "initials",
      "color", "language", "is_seed", "created_at",
    ]);

    const reviewIds = new Map<number, number>();
    for (const row of legacyData.reviews) {
      const result = await client.query<{ id: number }>(
        `INSERT INTO reviews (user_id,book_id,rating,text,created_at)
         VALUES ($1,$2,$3,$4,$5)
         ON CONFLICT (user_id,book_id) DO UPDATE
         SET rating=EXCLUDED.rating,text=EXCLUDED.text,created_at=EXCLUDED.created_at
         RETURNING id`,
        [row.user_id, row.book_id, row.rating, row.text, row.created_at],
      );
      reviewIds.set(Number(row.id), result.rows[0].id);
    }

    await importRows(client, legacyData.shelves, "shelves", [
      "user_id", "book_id", "status", "updated_at",
    ], ["user_id", "book_id"], ["status", "updated_at"]);
    await importRows(client, legacyData.follows, "follows", [
      "follower_id", "followee_id", "created_at",
    ]);

    for (const row of legacyData.review_likes) {
      const reviewId = reviewIds.get(Number(row.review_id));
      if (reviewId === undefined) throw new Error(`SQLite like refers to missing review ${row.review_id}.`);
      await client.query(
        `INSERT INTO review_likes (user_id,review_id,created_at)
         VALUES ($1,$2,$3) ON CONFLICT DO NOTHING`,
        [row.user_id, reviewId, row.created_at],
      );
    }

    for (const row of legacyData.review_comments) {
      const reviewId = reviewIds.get(Number(row.review_id));
      if (reviewId === undefined) throw new Error(`SQLite comment refers to missing review ${row.review_id}.`);
      await client.query(
        `INSERT INTO review_comments (user_id,review_id,text,created_at)
         VALUES ($1,$2,$3,$4)`,
        [row.user_id, reviewId, row.text, row.created_at],
      );
    }

    for (const row of legacyData.notifications) {
      const isReviewNotification = ["review", "like", "comment"].includes(String(row.kind));
      const reviewId = isReviewNotification ? reviewIds.get(Number(row.entity_id)) : undefined;
      if (isReviewNotification && reviewId === undefined) {
        throw new Error(`SQLite notification refers to missing review ${row.entity_id}.`);
      }
      const entityId = isReviewNotification ? String(reviewId) : row.entity_id;
      await client.query(
        `INSERT INTO notifications (recipient_id,actor_id,kind,entity_id,created_at,read_at)
         VALUES ($1,$2,$3,$4,$5,$6)`,
        [row.recipient_id, row.actor_id, row.kind, entityId, row.created_at, row.read_at],
      );
    }

    await client.query(
      "INSERT INTO sqlite_imports (source_hash,imported_at) VALUES ($1,$2)",
      [sourceKey, nowSeconds()],
    );
    for (const table of ["reviews", "review_comments", "notifications"]) {
      await client.query(
        `SELECT setval(pg_get_serial_sequence('${table}','id'), COALESCE(MAX(id),1), MAX(id) IS NOT NULL) FROM ${table}`,
      );
    }
    await client.query("COMMIT");
    console.log("SQLite accounts and community data imported. Users must sign in again.");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : "SQLite import failed.");
  process.exitCode = 1;
});
