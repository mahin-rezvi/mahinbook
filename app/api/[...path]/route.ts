import { createHash, pbkdf2, randomBytes, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";
import type { PoolClient, QueryResultRow } from "pg";
import { ensureDatabase, getPool, nowSeconds } from "@/lib/db";

export const runtime = "nodejs";

const hashPassword = promisify(pbkdf2);
const sessionDays = 30;
type UserRow = QueryResultRow & {
  id: string;
  name: string;
  email: string;
  password_salt: string;
  password_hash: string;
  bio: string;
  initials: string;
  color: string;
  language: string;
  is_seed: boolean;
  created_at: number;
};
type JsonObject = Record<string, unknown>;
type ApiError = Error & { status?: number; code?: string };

function json(payload: unknown, status = 200, headers?: HeadersInit): Response {
  const responseHeaders = new Headers(headers);
  responseHeaders.set("Cache-Control", "no-store");
  responseHeaders.set("X-Content-Type-Options", "nosniff");
  return Response.json(payload, { status, headers: responseHeaders });
}

function fail(message: string, status = 400): Response {
  return json({ error: message }, status);
}

function appError(message: string, status: number): ApiError {
  return Object.assign(new Error(message), { status });
}

function statusOf(error: unknown): number | undefined {
  return error && typeof error === "object" && "status" in error
    ? Number((error as ApiError).status)
    : undefined;
}

function stringValue(value: unknown, fallback = ""): string {
  return typeof value === "string" ? value : fallback;
}

async function readJson(request: Request): Promise<JsonObject> {
  const contentLength = Number(request.headers.get("content-length") || 0);
  if (contentLength > 256_000) {
    throw appError("Request is too large.", 400);
  }
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    throw appError("Send a valid JSON request.", 400);
  }
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    throw appError("Send a valid JSON request.", 400);
  }
  return body as JsonObject;
}

function sessionToken(request: Request): string | null {
  const cookie = request.headers.get("cookie") || "";
  const entry = cookie.split(";").map((item) => item.trim()).find((item) => item.startsWith("mb_session="));
  const token = entry?.slice("mb_session=".length);
  return token && /^[A-Za-z0-9_-]+$/.test(token) ? token : null;
}

function sessionCookie(token: string, maxAge: number): string {
  const secure = process.env.NODE_ENV === "production" ? "; Secure" : "";
  return `mb_session=${token}; HttpOnly; SameSite=Lax; Path=/; Max-Age=${maxAge}${secure}`;
}

async function currentUser(request: Request): Promise<UserRow | null> {
  const token = sessionToken(request);
  if (!token) return null;
  const tokenHash = createHash("sha256").update(token).digest("hex");
  const result = await getPool().query<UserRow>(
    `SELECT u.* FROM sessions s JOIN users u ON u.id=s.user_id
     WHERE s.token_hash=$1 AND s.expires_at>$2`,
    [tokenHash, nowSeconds()],
  );
  return result.rows[0] || null;
}

async function userPublic(userId: string, viewerId: string | null): Promise<JsonObject | null> {
  const db = getPool();
  const userResult = await db.query(
    `SELECT id,name,bio,initials,color,created_at,is_seed FROM users WHERE id=$1`,
    [userId],
  );
  const user = userResult.rows[0];
  if (!user) return null;

  const [reviews, booksCount, followers, following, followed] = await Promise.all([
    db.query<{ count: number }>("SELECT COUNT(*)::integer AS count FROM reviews WHERE user_id=$1", [userId]),
    db.query<{ count: number }>("SELECT COUNT(*)::integer AS count FROM shelves WHERE user_id=$1", [userId]),
    db.query<{ count: number }>("SELECT COUNT(*)::integer AS count FROM follows WHERE followee_id=$1", [userId]),
    db.query<{ count: number }>("SELECT COUNT(*)::integer AS count FROM follows WHERE follower_id=$1", [userId]),
    viewerId
      ? db.query("SELECT 1 FROM follows WHERE follower_id=$1 AND followee_id=$2", [viewerId, userId])
      : Promise.resolve({ rows: [] }),
  ]);

  return {
    ...user,
    review_count: reviews.rows[0].count,
    books_count: booksCount.rows[0].count,
    followers: followers.rows[0].count,
    following: following.rows[0].count,
    is_following: followed.rows.length > 0,
  };
}

async function makeSession(client: PoolClient, userId: string): Promise<string> {
  const token = randomBytes(36).toString("base64url");
  const expiresAt = nowSeconds() + sessionDays * 86_400;
  const tokenHash = createHash("sha256").update(token).digest("hex");
  await client.query("INSERT INTO sessions (token_hash,user_id,expires_at) VALUES ($1,$2,$3)", [
    tokenHash,
    userId,
    expiresAt,
  ]);
  return token;
}

async function withTransaction<T>(run: (client: PoolClient) => Promise<T>): Promise<T> {
  const client = await getPool().connect();
  try {
    await client.query("BEGIN");
    const result = await run(client);
    await client.query("COMMIT");
    return result;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

async function bookData(row: QueryResultRow, userId: string | null): Promise<JsonObject> {
  const db = getPool();
  const [stats, saved] = await Promise.all([
    db.query<{ rating: number; review_count: number }>(
      "SELECT COALESCE(ROUND(AVG(rating),1),0)::float AS rating, COUNT(*)::integer AS review_count FROM reviews WHERE book_id=$1",
      [row.id],
    ),
    userId
      ? db.query<{ status: string }>("SELECT status FROM shelves WHERE user_id=$1 AND book_id=$2", [userId, row.id])
      : Promise.resolve({ rows: [] }),
  ]);
  return {
    ...row,
    rating: stats.rows[0].rating,
    review_count: stats.rows[0].review_count,
    status: saved.rows[0]?.status || null,
  };
}

async function reviewsForBook(bookId: string, viewerId: string | null): Promise<QueryResultRow[]> {
  const result = await getPool().query(
    `SELECT r.id,r.rating,r.text,r.created_at,u.id user_id,u.name,u.initials,u.color,
       (SELECT COUNT(*)::integer FROM review_likes l WHERE l.review_id=r.id) likes,
       EXISTS(SELECT 1 FROM review_likes l WHERE l.review_id=r.id AND l.user_id=$1) liked
     FROM reviews r JOIN users u ON u.id=r.user_id
     WHERE r.book_id=$2 ORDER BY r.created_at DESC`,
    [viewerId || "", bookId],
  );
  return result.rows;
}

async function reviewsForUser(userId: string, viewerId: string | null): Promise<QueryResultRow[]> {
  const result = await getPool().query(
    `SELECT r.id review_id,r.rating,r.text,r.created_at,b.id book_id,b.title,b.author,b.genre,b.color book_color,
       (SELECT COUNT(*)::integer FROM review_likes l WHERE l.review_id=r.id) likes,
       EXISTS(SELECT 1 FROM review_likes l WHERE l.review_id=r.id AND l.user_id=$1) liked
     FROM reviews r JOIN books b ON b.id=r.book_id
     WHERE r.user_id=$2 ORDER BY r.created_at DESC`,
    [viewerId || "", userId],
  );
  return result.rows;
}

async function shelvesForUser(userId: string, viewerId: string | null): Promise<JsonObject[]> {
  const result = await getPool().query(
    `SELECT b.*,s.status FROM shelves s JOIN books b ON b.id=s.book_id
     WHERE s.user_id=$1 ORDER BY s.updated_at DESC`,
    [userId],
  );
  return Promise.all(result.rows.map(async (row) => ({
    ...await bookData(row, userId === viewerId ? viewerId : null),
    status: row.status,
  })));
}

function apiPath(request: Request): string[] {
  return new URL(request.url).pathname
    .slice("/api/".length)
    .split("/")
    .filter(Boolean)
    .map(decodeURIComponent);
}

async function getRoute(request: Request, segments: string[]): Promise<Response> {
  const db = getPool();
  const user = await currentUser(request);
  const userId = user?.id || null;

  if (segments.length === 1 && segments[0] === "me") {
    if (!user) return json({ user: null });
    const me = await userPublic(user.id, user.id);
    return json({ user: { ...me, email: user.email, language: user.language } });
  }

  if (segments.length === 1 && segments[0] === "books") {
    const url = new URL(request.url);
    const query = (url.searchParams.get("q") || "").trim().toLowerCase();
    const genre = url.searchParams.get("genre") || "";
    const filters: string[] = [];
    const values: string[] = [];
    if (query) {
      values.push(`%${query}%`);
      filters.push(`(lower(title) LIKE $${values.length} OR lower(author) LIKE $${values.length} OR lower(summary) LIKE $${values.length})`);
    }
    if (genre && genre !== "All books") {
      values.push(genre);
      filters.push(`genre=$${values.length}`);
    }
    const result = await db.query(
      `SELECT * FROM books ${filters.length ? `WHERE ${filters.join(" AND ")}` : ""} ORDER BY title`,
      values,
    );
    const genres = await db.query("SELECT DISTINCT genre FROM books ORDER BY genre");
    return json({
      books: await Promise.all(result.rows.map((row) => bookData(row, userId))),
      genres: genres.rows.map((row) => row.genre),
    });
  }

  if (segments.length === 2 && segments[0] === "books") {
    const result = await db.query("SELECT * FROM books WHERE id=$1", [segments[1]]);
    if (!result.rows[0]) return fail("Book not found.", 404);
    return json({
      book: await bookData(result.rows[0], userId),
      reviews: await reviewsForBook(segments[1], userId),
    });
  }

  if (segments.length === 1 && segments[0] === "lists") {
    if (!user) return fail("Please sign in to view your shelf.", 401);
    const result = await db.query(
      `SELECT b.*,s.status,s.updated_at FROM shelves s JOIN books b ON b.id=s.book_id
       WHERE s.user_id=$1 ORDER BY s.updated_at DESC`,
      [user.id],
    );
    return json({ books: await Promise.all(result.rows.map((row) => bookData(row, user.id))) });
  }

  if (segments.length === 1 && segments[0] === "feed") {
    const result = await db.query(
      `SELECT r.id review_id,r.rating,r.text,r.created_at,
         u.id user_id,u.name,u.initials,u.color,u.bio,
         b.id book_id,b.title,b.author,b.genre,b.color book_color,
         (SELECT COUNT(*)::integer FROM review_likes l WHERE l.review_id=r.id) likes,
         EXISTS(SELECT 1 FROM review_likes l WHERE l.review_id=r.id AND l.user_id=$1) liked
       FROM reviews r JOIN users u ON u.id=r.user_id JOIN books b ON b.id=r.book_id
       ORDER BY r.created_at DESC LIMIT 24`,
      [userId || ""],
    );
    return json({ items: result.rows });
  }

  if (segments.length === 1 && segments[0] === "users") {
    const query = (new URL(request.url).searchParams.get("q") || "").trim().toLowerCase();
    const result = await db.query(
      `SELECT id FROM users WHERE lower(name) LIKE $1 ORDER BY is_seed DESC,name LIMIT 50`,
      [`%${query}%`],
    );
    const users = await Promise.all(
      result.rows.filter((row) => row.id !== userId).map((row) => userPublic(row.id, userId)),
    );
    return json({ users: users.filter((item) => item !== null) });
  }

  if (segments.length === 2 && segments[0] === "users") {
    const profile = await userPublic(segments[1], userId);
    if (!profile) return fail("Reader not found.", 404);
    return json({
      profile: {
        ...profile,
        reviews: await reviewsForUser(segments[1], userId),
        shelves: await shelvesForUser(segments[1], userId),
      },
    });
  }

  if (segments.length === 3 && segments[0] === "reviews" && segments[2] === "comments") {
    const comments = await db.query(
      `SELECT c.id,c.text,c.created_at,u.id user_id,u.name,u.initials,u.color
       FROM review_comments c JOIN users u ON u.id=c.user_id
       WHERE c.review_id=$1 ORDER BY c.created_at`,
      [segments[1]],
    );
    return json({ comments: comments.rows });
  }

  if (segments.length === 1 && segments[0] === "notifications") {
    if (!user) return fail("Please sign in to view notifications.", 401);
    const result = await db.query(
      `SELECT n.id,n.kind,n.entity_id,n.created_at,n.read_at,
         u.id actor_id,u.name actor_name,u.initials,u.color
       FROM notifications n JOIN users u ON u.id=n.actor_id
       WHERE n.recipient_id=$1 ORDER BY n.created_at DESC LIMIT 40`,
      [user.id],
    );
    return json({
      items: result.rows,
      unread: result.rows.filter((row) => row.read_at === null).length,
    });
  }

  if (segments.length === 1 && segments[0] === "export") {
    if (!user) return fail("Please sign in to export your data.", 401);
    const [profile, reviews, shelf, following] = await Promise.all([
      db.query("SELECT id,name,email,bio,language,created_at FROM users WHERE id=$1", [user.id]),
      db.query("SELECT book_id,rating,text,created_at FROM reviews WHERE user_id=$1", [user.id]),
      db.query("SELECT book_id,status,updated_at FROM shelves WHERE user_id=$1", [user.id]),
      db.query("SELECT followee_id FROM follows WHERE follower_id=$1", [user.id]),
    ]);
    return json({
      exported_at: nowSeconds(),
      profile: profile.rows[0],
      reviews: reviews.rows,
      shelf: shelf.rows,
      following: following.rows.map((row) => row.followee_id),
    });
  }

  return fail("Not found.", 404);
}

async function postRoute(request: Request, segments: string[], method: string): Promise<Response> {
  const db = getPool();
  const payload = method === "DELETE" ? {} : await readJson(request);
  const user = await currentUser(request);
  const userId = user?.id || null;

  if (segments.length === 2 && segments[0] === "auth" && segments[1] === "signup" && method === "POST") {
    const name = stringValue(payload.name).trim().slice(0, 60);
    const email = stringValue(payload.email).trim().toLowerCase().slice(0, 254);
    const password = stringValue(payload.password);
    if (name.length < 2 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return fail("Enter your name and a valid email address.");
    }
    if (password.length < 8 || password.length > 200) {
      return fail("Choose a password with at least 8 characters.");
    }
    const salt = randomBytes(16);
    const digest = await hashPassword(password, salt, 240_000, 32, "sha256") as Buffer;
    try {
      const result = await withTransaction(async (client) => {
        const id = randomBytes(12).toString("base64url");
        await client.query(
          `INSERT INTO users
           (id,name,email,password_salt,password_hash,initials,created_at)
           VALUES ($1,$2,$3,$4,$5,$6,$7)`,
          [id, name, email, salt.toString("hex"), digest.toString("hex"), name.split(/\s+/).slice(0, 2).map((part) => part[0]).join("").toUpperCase(), nowSeconds()],
        );
        return { id, token: await makeSession(client, id) };
      });
      const me = await userPublic(result.id, result.id);
      return json(
        { user: { ...me, email, language: "en" } },
        201,
        { "Set-Cookie": sessionCookie(result.token, sessionDays * 86_400) },
      );
    } catch (error) {
      if (error && typeof error === "object" && "code" in error && error.code === "23505") {
        return fail("An account already uses that email.", 409);
      }
      throw error;
    }
  }

  if (segments.length === 2 && segments[0] === "auth" && segments[1] === "login" && method === "POST") {
    const email = stringValue(payload.email).trim().toLowerCase();
    const result = await db.query<UserRow>("SELECT * FROM users WHERE email=$1", [email]);
    const account = result.rows[0];
    if (!account) return fail("Email or password is incorrect.", 401);
    const digest = await hashPassword(
      stringValue(payload.password),
      Buffer.from(account.password_salt, "hex"),
      240_000,
      32,
      "sha256",
    ) as Buffer;
    const savedDigest = Buffer.from(account.password_hash, "hex");
    if (digest.length !== savedDigest.length || !timingSafeEqual(digest, savedDigest)) {
      return fail("Email or password is incorrect.", 401);
    }
    const token = await withTransaction((client) => makeSession(client, account.id));
    const me = await userPublic(account.id, account.id);
    return json(
      { user: { ...me, email: account.email, language: account.language } },
      200,
      { "Set-Cookie": sessionCookie(token, sessionDays * 86_400) },
    );
  }

  if (segments.length === 2 && segments[0] === "auth" && segments[1] === "logout" && method === "POST") {
    const token = sessionToken(request);
    if (token) {
      const tokenHash = createHash("sha256").update(token).digest("hex");
      await db.query("DELETE FROM sessions WHERE token_hash=$1", [tokenHash]);
    }
    return json({ ok: true }, 200, { "Set-Cookie": sessionCookie("", 0) });
  }

  if (segments[0] === "auth") return fail("Not found.", 404);
  if (!user) return fail("Please sign in to continue.", 401);

  if (segments.length === 1 && segments[0] === "me" && ["PATCH", "PUT"].includes(method)) {
    const name = stringValue(payload.name, user.name).trim().slice(0, 60);
    const bio = stringValue(payload.bio, user.bio).trim().slice(0, 280);
    const language = stringValue(payload.language, user.language);
    if (name.length < 2 || !["en", "bn"].includes(language)) {
      return fail("Check your name and language settings.");
    }
    await db.query(
      "UPDATE users SET name=$1,bio=$2,initials=$3,language=$4 WHERE id=$5",
      [name, bio, name.split(/\s+/).slice(0, 2).map((part) => part[0]).join("").toUpperCase(), language, user.id],
    );
    return json({ user: { ...await userPublic(user.id, user.id), email: user.email, language } });
  }

  if (segments.length === 1 && segments[0] === "me" && method === "DELETE") {
    if (user.is_seed) return fail("Sample community accounts cannot be deleted.", 403);
    await db.query("DELETE FROM users WHERE id=$1", [user.id]);
    return json({ ok: true }, 200, { "Set-Cookie": sessionCookie("", 0) });
  }

  if (segments.length === 2 && segments[0] === "lists" && ["POST", "PUT", "DELETE"].includes(method)) {
    const bookId = segments[1];
    const book = await db.query("SELECT 1 FROM books WHERE id=$1", [bookId]);
    if (!book.rows[0]) return fail("Book not found.", 404);
    if (method === "DELETE") {
      await db.query("DELETE FROM shelves WHERE user_id=$1 AND book_id=$2", [user.id, bookId]);
      return json({ ok: true });
    }
    const status = stringValue(payload.status, "To Read");
    if (!["To Read", "Reading", "Completed"].includes(status)) {
      return fail("Choose To Read, Reading, or Completed.");
    }
    await db.query(
      `INSERT INTO shelves (user_id,book_id,status,updated_at) VALUES ($1,$2,$3,$4)
       ON CONFLICT (user_id,book_id) DO UPDATE SET status=EXCLUDED.status,updated_at=EXCLUDED.updated_at`,
      [user.id, bookId, status, nowSeconds()],
    );
    return json({ ok: true, status });
  }

  if (segments.length === 3 && segments[0] === "books" && segments[2] === "reviews" && method === "POST") {
    const bookId = segments[1];
    const rating = payload.rating;
    const text = stringValue(payload.text).trim().slice(0, 2000);
    const book = await db.query("SELECT 1 FROM books WHERE id=$1", [bookId]);
    if (!book.rows[0]) return fail("Book not found.", 404);
    if (typeof rating !== "number" || !Number.isInteger(rating) || rating < 1 || rating > 5 || text.length < 3) {
      return fail("Choose a 1–5 star rating and write at least 3 characters.");
    }
    const now = nowSeconds();
    const reviewId = await withTransaction(async (client) => {
      const result = await client.query<{ id: number }>(
        `INSERT INTO reviews (user_id,book_id,rating,text,created_at) VALUES ($1,$2,$3,$4,$5)
         ON CONFLICT (user_id,book_id) DO UPDATE
         SET rating=EXCLUDED.rating,text=EXCLUDED.text,created_at=EXCLUDED.created_at
         RETURNING id`,
        [user.id, bookId, rating, text, now],
      );
      const id = result.rows[0].id;
      await client.query(
        `INSERT INTO shelves (user_id,book_id,status,updated_at) VALUES ($1,$2,'Completed',$3)
         ON CONFLICT (user_id,book_id) DO NOTHING`,
        [user.id, bookId, now],
      );
      await client.query(
        `INSERT INTO notifications (recipient_id,actor_id,kind,entity_id,created_at)
         SELECT follower_id,$1,'review',$2,$3 FROM follows
         WHERE followee_id=$1 AND follower_id<>$1`,
        [user.id, String(id), now],
      );
      return id;
    });
    return json({ ok: true, review_id: reviewId }, 201);
  }

  if (segments.length === 3 && segments[0] === "users" && segments[2] === "follow" && ["POST", "DELETE"].includes(method)) {
    const target = segments[1];
    if (target === user.id) return fail("You cannot follow yourself.");
    const exists = await db.query("SELECT 1 FROM users WHERE id=$1", [target]);
    if (!exists.rows[0]) return fail("Reader not found.", 404);
    if (method === "POST") {
      await withTransaction(async (client) => {
        await client.query(
          "INSERT INTO follows (follower_id,followee_id,created_at) VALUES ($1,$2,$3) ON CONFLICT DO NOTHING",
          [user.id, target, nowSeconds()],
        );
        await client.query(
          "INSERT INTO notifications (recipient_id,actor_id,kind,entity_id,created_at) VALUES ($1,$2,'follow',$2,$3)",
          [target, user.id, nowSeconds()],
        );
      });
    } else {
      await db.query("DELETE FROM follows WHERE follower_id=$1 AND followee_id=$2", [user.id, target]);
    }
    return json({ ok: true, following: method === "POST" });
  }

  if (segments.length === 3 && segments[0] === "reviews" && segments[2] === "like" && method === "POST") {
    const reviewId = Number(segments[1]);
    if (!Number.isSafeInteger(reviewId) || reviewId < 1) return fail("Review not found.", 404);
    const result = await withTransaction(async (client) => {
      const review = await client.query<{ user_id: string }>(
        "SELECT user_id FROM reviews WHERE id=$1 FOR UPDATE",
        [reviewId],
      );
      if (!review.rows[0]) throw appError("Review not found.", 404);
      const existing = await client.query(
        "SELECT 1 FROM review_likes WHERE user_id=$1 AND review_id=$2",
        [user.id, reviewId],
      );
      const liked = existing.rows.length === 0;
      if (liked) {
        await client.query(
          "INSERT INTO review_likes (user_id,review_id,created_at) VALUES ($1,$2,$3)",
          [user.id, reviewId, nowSeconds()],
        );
        if (review.rows[0].user_id !== user.id) {
          await client.query(
            "INSERT INTO notifications (recipient_id,actor_id,kind,entity_id,created_at) VALUES ($1,$2,'like',$3,$4)",
            [review.rows[0].user_id, user.id, String(reviewId), nowSeconds()],
          );
        }
      } else {
        await client.query("DELETE FROM review_likes WHERE user_id=$1 AND review_id=$2", [user.id, reviewId]);
      }
      const count = await client.query<{ count: number }>(
        "SELECT COUNT(*)::integer AS count FROM review_likes WHERE review_id=$1",
        [reviewId],
      );
      return { liked, likes: count.rows[0].count };
    });
    return json(result);
  }

  if (segments.length === 3 && segments[0] === "reviews" && segments[2] === "comments" && method === "POST") {
    const reviewId = Number(segments[1]);
    const comment = stringValue(payload.text).trim().slice(0, 1000);
    if (!Number.isSafeInteger(reviewId) || reviewId < 1) return fail("Review not found.", 404);
    const result = await withTransaction(async (client) => {
      const review = await client.query<{ user_id: string }>("SELECT user_id FROM reviews WHERE id=$1", [reviewId]);
      if (!review.rows[0]) throw appError("Review not found.", 404);
      if (comment.length < 2) throw appError("Write at least 2 characters.", 400);
      const now = nowSeconds();
      const inserted = await client.query<{ id: number }>(
        "INSERT INTO review_comments (user_id,review_id,text,created_at) VALUES ($1,$2,$3,$4) RETURNING id",
        [user.id, reviewId, comment, now],
      );
      if (review.rows[0].user_id !== user.id) {
        await client.query(
          "INSERT INTO notifications (recipient_id,actor_id,kind,entity_id,created_at) VALUES ($1,$2,'comment',$3,$4)",
          [review.rows[0].user_id, user.id, String(reviewId), now],
        );
      }
      return { id: inserted.rows[0].id, text: comment, created_at: now };
    });
    return json(result, 201);
  }

  if (segments.length === 2 && segments[0] === "notifications" && segments[1] === "read" && method === "POST") {
    await db.query(
      "UPDATE notifications SET read_at=$1 WHERE recipient_id=$2 AND read_at IS NULL",
      [nowSeconds(), user.id],
    );
    return json({ ok: true });
  }

  return fail("Not found.", 404);
}

async function handle(request: Request): Promise<Response> {
  try {
    await ensureDatabase();
    const segments = apiPath(request);
    if (segments.length === 0) return fail("Not found.", 404);
    if (request.method === "GET") return await getRoute(request, segments);
    if (["POST", "PUT", "PATCH", "DELETE"].includes(request.method)) {
      return await postRoute(request, segments, request.method);
    }
    return fail("Method not allowed.", 405);
  } catch (error) {
    const status = statusOf(error);
    if (status) return fail(error instanceof Error ? error.message : "Request failed.", status);
    console.error("MahinBook API error:", error);
    return fail("Something went wrong. Please try again.", 500);
  }
}

export const GET = handle;
export const POST = handle;
export const PUT = handle;
export const PATCH = handle;
export const DELETE = handle;
