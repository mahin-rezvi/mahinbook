#!/usr/bin/env python3
"""MahinBook: a small, dependency-free reading community app."""
from __future__ import annotations

import hashlib
import json
import mimetypes
import os
import re
import secrets
import sqlite3
import time
from http import HTTPStatus # pyright: ignore[reportUnusedImport]
from http.cookies import SimpleCookie
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import parse_qs, unquote, urlparse

ROOT = Path(__file__).resolve().parent
WEB = ROOT / "web"
DATA_DIR = ROOT / "data"
DB_PATH = Path(os.environ.get("MAHINBOOK_DB", DATA_DIR / "mahinbook.sqlite3"))
PORT = int(os.environ.get("PORT", "8000"))
SESSION_DAYS = 30

BOOKS = [
    ("pride-and-prejudice", "Pride and Prejudice", "Jane Austen", "Classic", 1813, 432, "A sharp, warm comedy of manners about first impressions, family, and finding an equal. See why Elizabeth Bennet and Mr Darcy endure.", "#cf765e"),
    ("little-women", "Little Women", "Louisa May Alcott", "Classic", 1868, 449, "Four sisters grow up, dream big, and find their own paths in this intimate story of family and becoming.", "#687c60"),
    ("jane-eyre", "Jane Eyre", "Charlotte Brontë", "Classic", 1847, 532, "An orphaned governess insists on her independence and discovers a love wrapped in secrets.", "#765f78"),
    ("the-secret-garden", "The Secret Garden", "Frances Hodgson Burnett", "Fiction", 1911, 331, "A lonely child, a walled garden, and the quiet magic of tending to something living.", "#71865d"),
    ("the-great-gatsby", "The Great Gatsby", "F. Scott Fitzgerald", "Classic", 1925, 180, "One summer on Long Island, a glittering party hides a tender and tragic American dream.", "#d5a94d"),
    ("the-picture-of-dorian-gray", "The Picture of Dorian Gray", "Oscar Wilde", "Classic", 1890, 254, "A beautiful young man stays untouched by time while a portrait bears the cost of every choice.", "#a66464"),
    ("frankenstein", "Frankenstein", "Mary Shelley", "Sci-fi", 1818, 280, "A daring experiment gives life to a creature, raising questions about creation, care, and belonging.", "#697b87"),
    ("sherlock-holmes", "The Adventures of Sherlock Holmes", "Arthur Conan Doyle", "Mystery", 1892, 307, "Twelve ingenious cases put the world's most famous consulting detective and Dr Watson to work.", "#a1784d"),
    ("alice-in-wonderland", "Alice's Adventures in Wonderland", "Lewis Carroll", "Fantasy", 1865, 192, "Follow Alice down the rabbit hole into a wonderfully peculiar world where logic takes a holiday.", "#7d76a2"),
    ("the-count-of-monte-cristo", "The Count of Monte Cristo", "Alexandre Dumas", "Adventure", 1844, 1276, "Wrongfully imprisoned, Edmond Dantès escapes and returns with a plan years in the making.", "#566c84"),
    ("anne-of-green-gables", "Anne of Green Gables", "L. M. Montgomery", "Fiction", 1908, 384, "An imaginative orphan finds a home, friendship, and plenty of scrapes in Prince Edward Island.", "#ba7253"),
    ("the-time-machine", "The Time Machine", "H. G. Wells", "Sci-fi", 1895, 118, "A Victorian inventor travels to the far future and finds a civilization unlike anything expected.", "#73838b"),
    ("a-room-with-a-view", "A Room with a View", "E. M. Forster", "Romance", 1908, 321, "A trip to Italy opens up a choice between a comfortable life and the one Lucy truly wants.", "#c88460"),
    ("the-yellow-wallpaper", "The Yellow Wallpaper", "Charlotte Perkins Gilman", "Fiction", 1892, 64, "A woman confined to a room begins to see a troubling story emerge from its wallpaper.", "#c59d5b"),
    ("dracula", "Dracula", "Bram Stoker", "Horror", 1897, 418, "Letters, diaries, and ship logs tell of a voyage from Transylvania and the darkness that follows.", "#715d6a"),
    ("the-wind-in-the-willows", "The Wind in the Willows", "Kenneth Grahame", "Fantasy", 1908, 302, "Mole, Rat, Badger, and the irrepressible Mr Toad make a home beside the river.", "#63806d"),
    ("northanger-abbey", "Northanger Abbey", "Jane Austen", "Romance", 1817, 252, "A young reader's Gothic imagination meets real life during a season of friendship and flirtation.", "#aa7a75"),
    ("the-call-of-the-wild", "The Call of the Wild", "Jack London", "Adventure", 1903, 172, "A domesticated dog is pulled into the harsh beauty of the Yukon during the gold rush.", "#75805b"),
    ("the-odyssey", "The Odyssey", "Homer", "Adventure", -700, 541, "A long and perilous journey home brings Odysseus face to face with gods, monsters, and his own resolve.", "#6f8290"),
    ("the-metamorphosis", "The Metamorphosis", "Franz Kafka", "Fiction", 1915, 96, "Gregor Samsa wakes transformed, and his family's ordinary life becomes something strange.", "#846f62"),
    ("the-prince", "The Prince", "Niccolò Machiavelli", "History", 1532, 140, "A compact, provocative reflection on power and political leadership in Renaissance Italy.", "#9a704f"),
    ("meditations", "Meditations", "Marcus Aurelius", "Philosophy", 180, 254, "Private notes from a Roman emperor offer practical reflections on attention, character, and change.", "#7e7c6c"),
    ("the-art-of-war", "The Art of War", "Sun Tzu", "History", -500, 96, "A concise ancient strategy text whose lessons have travelled far beyond the battlefield.", "#ab634c"),
    ("around-the-world", "Around the World in Eighty Days", "Jules Verne", "Adventure", 1873, 284, "Phileas Fogg wagers he can circle the globe in eighty days, then sets off at once.", "#5e7a87"),
    ("the-jungle-book", "The Jungle Book", "Rudyard Kipling", "Fantasy", 1894, 301, "Mowgli's adventures in the Indian jungle sit alongside fables of friendship and survival.", "#71805b"),
    ("the-woman-in-white", "The Woman in White", "Wilkie Collins", "Mystery", 1859, 672, "A chance meeting on a moonlit road begins a Victorian mystery told through many voices.", "#707f8f"),
    ("a-little-princess", "A Little Princess", "Frances Hodgson Burnett", "Fiction", 1905, 256, "Sara Crewe holds on to kindness and imagination when a sudden change turns her world upside down.", "#9a7892"),
    ("the-importance-of-being-earnest", "The Importance of Being Earnest", "Oscar Wilde", "Comedy", 1895, 76, "Two friends, two invented identities, and one very inconvenient handbag make a sparkling comedy.", "#c08b4e"),
    ("the-brothers-karamazov", "The Brothers Karamazov", "Fyodor Dostoevsky", "Classic", 1880, 824, "Three brothers confront faith, freedom, and responsibility after a family crime.", "#745d58"),
    ("the-legend-of-sleepy-hollow", "The Legend of Sleepy Hollow", "Washington Irving", "Horror", 1820, 64, "A schoolmaster, a headless horseman, and a spooky autumn night in the Hudson Valley.", "#8d694d"),
    ("the-scarlet-letter", "The Scarlet Letter", "Nathaniel Hawthorne", "Classic", 1850, 272, "In a strict Puritan town, Hester Prynne faces public judgment with a strength of her own.", "#a64f45"),
    ("the-railway-children", "The Railway Children", "E. Nesbit", "Fiction", 1906, 288, "Three siblings make a new home in the country and find adventure near the railway line.", "#687b6c"),
]

COMMUNITY = [
    ("alice-reader", "Alice Rahman", "alice@mahinbook.local", "A slow reader with a fast-growing TBR. Usually found with tea and a mystery novel.", "AR", "#ce795f"),
    ("omar-reads", "Omar Hasan", "omar@mahinbook.local", "I read a little of everything, especially old books with big ideas.", "OH", "#66816c"),
    ("nina-pages", "Nina Sultana", "nina@mahinbook.local", "Here for the characters, the marginalia, and the happy endings.", "NS", "#81729b"),
    ("leo-library", "Leo Chowdhury", "leo@mahinbook.local", "Building a bookshelf one unexpected recommendation at a time.", "LC", "#a77950"),
]

SEED_REVIEWS = [
    ("alice-reader", "pride-and-prejudice", 5, "Elizabeth's voice still feels bright and modern. I expected a romance and got a very funny book about paying attention."),
    ("omar-reads", "frankenstein", 5, "The creature's chapters stayed with me much longer than the lightning and laboratory scenes."),
    ("nina-pages", "the-secret-garden", 4, "A gentle reminder that care changes things. The garden is the real main character."),
    ("leo-library", "the-great-gatsby", 4, "Beautiful sentences and a sadness that sneaks up on you. Best read slowly."),
    ("alice-reader", "jane-eyre", 5, "Jane's independence is the heart of this book. I loved how clearly she knows her own worth."),
    ("omar-reads", "meditations", 4, "Not a book to rush. A few lines at a time made for a surprisingly good daily ritual."),
    ("nina-pages", "the-woman-in-white", 4, "The changing narrators made this feel like a campfire mystery told by a whole room."),
]


def connect() -> sqlite3.Connection:
    DB_PATH.parent.mkdir(parents=True, exist_ok=True)
    db = sqlite3.connect(DB_PATH, timeout=10)
    db.row_factory = sqlite3.Row
    db.execute("PRAGMA foreign_keys = ON")
    return db


def password_hash(password: str, salt: bytes | None = None) -> tuple[str, str]:
    salt = salt or secrets.token_bytes(16)
    digest = hashlib.pbkdf2_hmac("sha256", password.encode(), salt, 240_000)
    return salt.hex(), digest.hex()


def init_db() -> None:
    with connect() as db:
        db.executescript("""
            CREATE TABLE IF NOT EXISTS users (
                id TEXT PRIMARY KEY, name TEXT NOT NULL, email TEXT NOT NULL UNIQUE,
                password_salt TEXT NOT NULL, password_hash TEXT NOT NULL,
                bio TEXT NOT NULL DEFAULT '', initials TEXT NOT NULL DEFAULT '',
                color TEXT NOT NULL DEFAULT '#ce795f', language TEXT NOT NULL DEFAULT 'en',
                is_seed INTEGER NOT NULL DEFAULT 0, created_at INTEGER NOT NULL
            );
            CREATE TABLE IF NOT EXISTS sessions (
                token_hash TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                expires_at INTEGER NOT NULL
            );
            CREATE TABLE IF NOT EXISTS books (
                id TEXT PRIMARY KEY, title TEXT NOT NULL, author TEXT NOT NULL, genre TEXT NOT NULL,
                year INTEGER NOT NULL, pages INTEGER NOT NULL, summary TEXT NOT NULL, color TEXT NOT NULL
            );
            CREATE TABLE IF NOT EXISTS shelves (
                user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                book_id TEXT NOT NULL REFERENCES books(id) ON DELETE CASCADE,
                status TEXT NOT NULL CHECK(status IN ('To Read','Reading','Completed')),
                updated_at INTEGER NOT NULL, PRIMARY KEY(user_id, book_id)
            );
            CREATE TABLE IF NOT EXISTS reviews (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                book_id TEXT NOT NULL REFERENCES books(id) ON DELETE CASCADE,
                rating INTEGER NOT NULL CHECK(rating BETWEEN 1 AND 5),
                text TEXT NOT NULL, created_at INTEGER NOT NULL,
                UNIQUE(user_id, book_id)
            );
            CREATE TABLE IF NOT EXISTS follows (
                follower_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                followee_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                created_at INTEGER NOT NULL, PRIMARY KEY(follower_id, followee_id),
                CHECK(follower_id != followee_id)
            );
            CREATE TABLE IF NOT EXISTS review_likes (
                user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                review_id INTEGER NOT NULL REFERENCES reviews(id) ON DELETE CASCADE,
                created_at INTEGER NOT NULL, PRIMARY KEY(user_id, review_id)
            );
            CREATE TABLE IF NOT EXISTS review_comments (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                review_id INTEGER NOT NULL REFERENCES reviews(id) ON DELETE CASCADE,
                text TEXT NOT NULL, created_at INTEGER NOT NULL
            );
            CREATE TABLE IF NOT EXISTS notifications (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                recipient_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                actor_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                kind TEXT NOT NULL, entity_id TEXT NOT NULL DEFAULT '', created_at INTEGER NOT NULL,
                read_at INTEGER
            );
            CREATE INDEX IF NOT EXISTS review_book_idx ON reviews(book_id, created_at DESC);
            CREATE INDEX IF NOT EXISTS notification_user_idx ON notifications(recipient_id, created_at DESC);
        """)
        db.executemany("INSERT OR IGNORE INTO books VALUES (?,?,?,?,?,?,?,?)", BOOKS)
        for uid, name, email, bio, initials, color in COMMUNITY:
            salt, hashed = password_hash(secrets.token_urlsafe(32))
            db.execute("""INSERT OR IGNORE INTO users
                (id,name,email,password_salt,password_hash,bio,initials,color,is_seed,created_at)
                VALUES (?,?,?,?,?,?,?,?,1,?)""",
                (uid, name, email, salt, hashed, bio, initials, color, int(time.time())))
        for uid, book, rating, body in SEED_REVIEWS:
            db.execute("INSERT OR IGNORE INTO reviews(user_id,book_id,rating,text,created_at) VALUES (?,?,?,?,?)",
                       (uid, book, rating, body, int(time.time()) - (len(SEED_REVIEWS) - SEED_REVIEWS.index((uid, book, rating, body))) * 86400))
        # Give the sample community a few visible shelf entries.
        for uid, book, status in [("alice-reader", "the-wind-in-the-willows", "Reading"),
                                  ("omar-reads", "the-odyssey", "To Read"),
                                  ("nina-pages", "a-room-with-a-view", "Completed"),
                                  ("leo-library", "the-call-of-the-wild", "Reading")]:
            db.execute("INSERT OR IGNORE INTO shelves VALUES (?,?,?,?)", (uid, book, status, int(time.time())))


def row_dict(row: sqlite3.Row | None) -> dict | None:
    return dict(row) if row else None


def book_data(db: sqlite3.Connection, row: sqlite3.Row, user_id: str | None = None) -> dict:
    item = dict(row)
    stats = db.execute("SELECT ROUND(AVG(rating),1) avg_rating, COUNT(*) review_count FROM reviews WHERE book_id=?", (item["id"],)).fetchone()
    item["rating"] = stats["avg_rating"] or 0
    item["review_count"] = stats["review_count"]
    item["status"] = None
    if user_id:
        saved = db.execute("SELECT status FROM shelves WHERE user_id=? AND book_id=?", (user_id, item["id"])).fetchone()
        item["status"] = saved["status"] if saved else None
    return item


def user_public(db: sqlite3.Connection, user_id: str, viewer_id: str | None = None) -> dict | None:
    user = db.execute("SELECT id,name,bio,initials,color,created_at,is_seed FROM users WHERE id=?", (user_id,)).fetchone()
    if not user:
        return None
    result = dict(user)
    result["review_count"] = db.execute("SELECT COUNT(*) FROM reviews WHERE user_id=?", (user_id,)).fetchone()[0]
    result["books_count"] = db.execute("SELECT COUNT(*) FROM shelves WHERE user_id=?", (user_id,)).fetchone()[0]
    result["followers"] = db.execute("SELECT COUNT(*) FROM follows WHERE followee_id=?", (user_id,)).fetchone()[0]
    result["following"] = db.execute("SELECT COUNT(*) FROM follows WHERE follower_id=?", (user_id,)).fetchone()[0]
    result["is_following"] = bool(viewer_id and db.execute("SELECT 1 FROM follows WHERE follower_id=? AND followee_id=?", (viewer_id,user_id)).fetchone())
    return result


class MahinBookHandler(BaseHTTPRequestHandler):
    server_version = "MahinBook/1.0"

    def log_message(self, fmt: str, *args) -> None:
        print("[%s] %s" % (self.log_date_time_string(), fmt % args))

    def send_json(self, payload, status=200, headers=None):
        body = json.dumps(payload, ensure_ascii=False, separators=(",", ":")).encode()
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Cache-Control", "no-store")
        self.send_header("X-Content-Type-Options", "nosniff")
        for key, value in (headers or {}).items():
            self.send_header(key, value)
        self.end_headers()
        self.wfile.write(body)

    def error(self, message, status=400):
        self.send_json({"error": message}, status)

    def body_json(self):
        try:
            length = int(self.headers.get("Content-Length", "0"))
            if length > 256_000:
                raise ValueError("Request is too large")
            return json.loads(self.rfile.read(length) or b"{}")
        except (ValueError, json.JSONDecodeError):
            raise ValueError("Send a valid JSON request")

    def current_user(self, db):
        cookies = SimpleCookie()
        cookies.load(self.headers.get("Cookie", ""))
        morsel = cookies.get("mb_session")
        if not morsel:
            return None
        token_hash = hashlib.sha256(morsel.value.encode()).hexdigest()
        row = db.execute("""SELECT u.* FROM sessions s JOIN users u ON u.id=s.user_id
            WHERE s.token_hash=? AND s.expires_at>?""", (token_hash, int(time.time()))).fetchone()
        return row_dict(row)

    def require_user(self, db):
        user = self.current_user(db)
        if not user:
            self.error("Please sign in to continue.", 401)
        return user

    def new_session(self, db, user_id):
        token = secrets.token_urlsafe(36)
        token_hash = hashlib.sha256(token.encode()).hexdigest()
        expires = int(time.time()) + SESSION_DAYS * 86400
        db.execute("INSERT INTO sessions VALUES (?,?,?)", (token_hash,user_id,expires))
        return {"Set-Cookie": f"mb_session={token}; HttpOnly; SameSite=Lax; Path=/; Max-Age={SESSION_DAYS*86400}"}

    def do_GET(self):
        parsed = urlparse(self.path)
        path = unquote(parsed.path)
        query = parse_qs(parsed.query)
        if path.startswith("/api/"):
            try:
                with connect() as db:
                    user = self.current_user(db)
                    uid = user["id"] if user else None
                    if path == "/api/me":
                        if not user:
                            return self.send_json({"user": None})
                        me = user_public(db, uid, uid)
                        me["email"] = user["email"]
                        me["language"] = user["language"]
                        return self.send_json({"user": me})
                    if path == "/api/books":
                        q = query.get("q", [""])[0].strip().lower()
                        genre = query.get("genre", [""])[0]
                        sql = "SELECT * FROM books WHERE 1=1"
                        args = []
                        if q:
                            sql += " AND (lower(title) LIKE ? OR lower(author) LIKE ? OR lower(summary) LIKE ?)"
                            args.extend([f"%{q}%"] * 3)
                        if genre and genre != "All books":
                            sql += " AND genre=?"
                            args.append(genre)
                        sql += " ORDER BY title"
                        rows = db.execute(sql, args).fetchall()
                        return self.send_json({"books": [book_data(db,r,uid) for r in rows],
                            "genres": [r[0] for r in db.execute("SELECT DISTINCT genre FROM books ORDER BY genre")]})
                    match = re.fullmatch(r"/api/books/([\w-]+)", path)
                    if match:
                        row = db.execute("SELECT * FROM books WHERE id=?", (match.group(1),)).fetchone()
                        if not row:
                            return self.error("Book not found.", 404)
                        reviews = self.reviews_for_book(db, row["id"], uid)
                        return self.send_json({"book": book_data(db,row,uid), "reviews": reviews})
                    if path == "/api/lists":
                        if not user:
                            return self.error("Please sign in to view your shelf.", 401)
                        rows = db.execute("SELECT b.*,s.status,s.updated_at FROM shelves s JOIN books b ON b.id=s.book_id WHERE s.user_id=? ORDER BY s.updated_at DESC", (uid,)).fetchall()
                        return self.send_json({"books": [book_data(db,r,uid) for r in rows]})
                    if path == "/api/feed":
                        feed_rows = db.execute("""SELECT r.id review_id,r.rating,r.text,r.created_at,
                            u.id user_id,u.name,u.initials,u.color,u.bio,b.id book_id,b.title,b.author,b.genre,b.color book_color,
                            (SELECT COUNT(*) FROM review_likes l WHERE l.review_id=r.id) likes,
                            EXISTS(SELECT 1 FROM review_likes l WHERE l.review_id=r.id AND l.user_id=?) liked
                            FROM reviews r JOIN users u ON u.id=r.user_id JOIN books b ON b.id=r.book_id
                            ORDER BY r.created_at DESC LIMIT 24""", (uid or "",)).fetchall()
                        return self.send_json({"items": [dict(r) for r in feed_rows]})
                    if path == "/api/users":
                        q = query.get("q", [""])[0].strip().lower()
                        rows = db.execute("SELECT id FROM users WHERE lower(name) LIKE ? ORDER BY is_seed DESC,name LIMIT 50", (f"%{q}%",)).fetchall()
                        return self.send_json({"users": [user_public(db,r["id"],uid) for r in rows if r["id"] != uid]})
                    match = re.fullmatch(r"/api/users/([\w-]+)", path)
                    if match:
                        profile = user_public(db, match.group(1), uid)
                        if not profile:
                            return self.error("Reader not found.", 404)
                        profile["reviews"] = self.reviews_for_user(db, match.group(1), uid)
                        profile["shelves"] = self.shelves_for_user(db, match.group(1), uid)
                        return self.send_json({"profile": profile})
                    match = re.fullmatch(r"/api/reviews/(\d+)/comments", path)
                    if match:
                        comments = db.execute("""SELECT c.id,c.text,c.created_at,u.id user_id,u.name,u.initials,u.color
                            FROM review_comments c JOIN users u ON u.id=c.user_id WHERE c.review_id=? ORDER BY c.created_at""", (match.group(1),)).fetchall()
                        return self.send_json({"comments": [dict(r) for r in comments]})
                    if path == "/api/notifications":
                        if not user:
                            return self.error("Please sign in to view notifications.", 401)
                        rows = db.execute("""SELECT n.id,n.kind,n.entity_id,n.created_at,n.read_at,u.id actor_id,u.name actor_name,u.initials,u.color
                            FROM notifications n JOIN users u ON u.id=n.actor_id WHERE n.recipient_id=? ORDER BY n.created_at DESC LIMIT 40""", (uid,)).fetchall()
                        return self.send_json({"items": [dict(r) for r in rows], "unread": sum(1 for r in rows if r["read_at"] is None)})
                    if path == "/api/export":
                        if not user:
                            return self.error("Please sign in to export your data.", 401)
                        return self.send_json(self.export_user(db, uid))
            except sqlite3.Error as exc:
                print("Database error:", exc)
                return self.error("Something went wrong. Please try again.", 500)
            return self.error("Not found.", 404)
        self.serve_file(path)

    def serve_file(self, path):
        relative = "index.html" if path == "/" else path.lstrip("/")
        target = (WEB / relative).resolve()
        try:
            target.relative_to(WEB.resolve())
        except ValueError:
            return self.error("Not found.", 404)
        if not target.is_file():
            return self.error("Not found.", 404)
        body = target.read_bytes()
        content_type = "application/manifest+json" if target.suffix == ".webmanifest" else (mimetypes.guess_type(str(target))[0] or "application/octet-stream")
        if target.suffix in (".js", ".css", ".webmanifest"):
            content_type += "; charset=utf-8"
        self.send_response(200)
        self.send_header("Content-Type", content_type)
        self.send_header("Content-Length", str(len(body)))
        self.send_header("X-Content-Type-Options", "nosniff")
        self.send_header("Cache-Control", "no-cache" if target.name == "service-worker.js" else "public, max-age=3600")
        self.end_headers()
        self.wfile.write(body)

    def reviews_for_book(self, db, book_id, viewer_id=None):
        rows = db.execute("""SELECT r.id,r.rating,r.text,r.created_at,u.id user_id,u.name,u.initials,u.color,
            (SELECT COUNT(*) FROM review_likes l WHERE l.review_id=r.id) likes,
            EXISTS(SELECT 1 FROM review_likes l WHERE l.review_id=r.id AND l.user_id=?) liked
            FROM reviews r JOIN users u ON u.id=r.user_id WHERE r.book_id=? ORDER BY r.created_at DESC""", (viewer_id or "",book_id)).fetchall()
        return [dict(r) for r in rows]

    def reviews_for_user(self, db, user_id, viewer_id=None):
        rows = db.execute("""SELECT r.id review_id,r.rating,r.text,r.created_at,b.id book_id,b.title,b.author,b.genre,b.color book_color,
            (SELECT COUNT(*) FROM review_likes l WHERE l.review_id=r.id) likes,
            EXISTS(SELECT 1 FROM review_likes l WHERE l.review_id=r.id AND l.user_id=?) liked
            FROM reviews r JOIN books b ON b.id=r.book_id WHERE r.user_id=? ORDER BY r.created_at DESC""", (viewer_id or "",user_id)).fetchall()
        return [dict(r) for r in rows]

    def shelves_for_user(self, db, user_id, viewer_id=None):
        rows = db.execute("SELECT b.*,s.status FROM shelves s JOIN books b ON b.id=s.book_id WHERE s.user_id=? ORDER BY s.updated_at DESC", (user_id,)).fetchall()
        return [book_data(db,r,viewer_id if user_id==viewer_id else None) | {"status":r["status"]} for r in rows]

    def export_user(self, db, user_id):
        user = db.execute("SELECT id,name,email,bio,language,created_at FROM users WHERE id=?",(user_id,)).fetchone()
        reviews = db.execute("SELECT book_id,rating,text,created_at FROM reviews WHERE user_id=?",(user_id,)).fetchall()
        shelves = db.execute("SELECT book_id,status,updated_at FROM shelves WHERE user_id=?",(user_id,)).fetchall()
        following = db.execute("SELECT followee_id FROM follows WHERE follower_id=?",(user_id,)).fetchall()
        return {"exported_at":int(time.time()),"profile":dict(user),"reviews":[dict(r) for r in reviews],"shelf":[dict(r) for r in shelves],"following":[r[0] for r in following]}

    def do_POST(self):
        self.mutate("POST")

    def do_PUT(self):
        self.mutate("PUT")

    def do_PATCH(self):
        self.mutate("PATCH")

    def do_DELETE(self):
        self.mutate("DELETE")

    def mutate(self, method):
        path = unquote(urlparse(self.path).path)
        try:
            payload = self.body_json() if method in ("POST","PUT","PATCH") else {}
        except ValueError as exc:
            return self.error(str(exc), 400)
        try:
            with connect() as db:
                user = self.current_user(db)
                uid = user["id"] if user else None
                if path == "/api/auth/signup" and method == "POST":
                    name = str(payload.get("name", "")).strip()[:60]
                    email = str(payload.get("email", "")).strip().lower()[:254]
                    password = str(payload.get("password", ""))
                    if len(name) < 2 or not re.fullmatch(r"[^\s@]+@[^\s@]+\.[^\s@]+", email):
                        return self.error("Enter your name and a valid email address.")
                    if len(password) < 8 or len(password) > 200:
                        return self.error("Choose a password with at least 8 characters.")
                    salt, hashed = password_hash(password)
                    new_id = secrets.token_urlsafe(12)
                    try:
                        db.execute("INSERT INTO users(id,name,email,password_salt,password_hash,initials,created_at) VALUES(?,?,?,?,?,?,?)",
                            (new_id,name,email,salt,hashed,"".join(p[0] for p in name.split()[:2]).upper(),int(time.time())))
                    except sqlite3.IntegrityError:
                        return self.error("An account already uses that email.", 409)
                    headers = self.new_session(db,new_id)
                    me = user_public(db,new_id,new_id); me["email"] = email; me["language"] = "en"
                    return self.send_json({"user":me},201,headers)
                if path == "/api/auth/login" and method == "POST":
                    email = str(payload.get("email","")).strip().lower()
                    row = db.execute("SELECT * FROM users WHERE email=?",(email,)).fetchone()
                    if not row:
                        return self.error("Email or password is incorrect.",401)
                    _, hashed = password_hash(str(payload.get("password","")),bytes.fromhex(row["password_salt"]))
                    if not secrets.compare_digest(hashed,row["password_hash"]):
                        return self.error("Email or password is incorrect.",401)
                    headers = self.new_session(db,row["id"])
                    me = user_public(db,row["id"],row["id"]); me["email"] = row["email"]; me["language"] = row["language"]
                    return self.send_json({"user":me},200,headers)
                if path == "/api/auth/logout" and method == "POST":
                    cookie = SimpleCookie(); cookie.load(self.headers.get("Cookie","")); morsel = cookie.get("mb_session")
                    if morsel:
                        db.execute("DELETE FROM sessions WHERE token_hash=?",(hashlib.sha256(morsel.value.encode()).hexdigest(),))
                    return self.send_json({"ok":True},200,{"Set-Cookie":"mb_session=; HttpOnly; SameSite=Lax; Path=/; Max-Age=0"})
                if path.startswith("/api/auth/") and path not in ("/api/auth/login","/api/auth/signup","/api/auth/logout"):
                    return self.error("Not found.",404)
                if not user:
                    return self.error("Please sign in to continue.",401)
                if path == "/api/me" and method in ("PATCH","PUT"):
                    name = str(payload.get("name",user["name"])).strip()[:60]
                    bio = str(payload.get("bio",user["bio"])).strip()[:280]
                    language = str(payload.get("language",user["language"]))
                    if len(name)<2 or language not in ("en","bn"):
                        return self.error("Check your name and language settings.")
                    db.execute("UPDATE users SET name=?,bio=?,initials=?,language=? WHERE id=?",(name,bio,"".join(p[0] for p in name.split()[:2]).upper(),language,uid))
                    me = user_public(db,uid,uid); me["email"] = user["email"]; me["language"] = language
                    return self.send_json({"user":me})
                if path == "/api/me" and method == "DELETE":
                    if user["is_seed"]:
                        return self.error("Sample community accounts cannot be deleted.",403)
                    db.execute("DELETE FROM users WHERE id=?",(uid,))
                    return self.send_json({"ok":True},200,{"Set-Cookie":"mb_session=; HttpOnly; SameSite=Lax; Path=/; Max-Age=0"})
                match = re.fullmatch(r"/api/lists/([\w-]+)",path)
                if match and method in ("POST","PUT","DELETE"):
                    book_id = match.group(1)
                    if not db.execute("SELECT 1 FROM books WHERE id=?",(book_id,)).fetchone():
                        return self.error("Book not found.",404)
                    if method == "DELETE":
                        db.execute("DELETE FROM shelves WHERE user_id=? AND book_id=?",(uid,book_id))
                        return self.send_json({"ok":True})
                    status = str(payload.get("status","To Read"))
                    if status not in ("To Read","Reading","Completed"):
                        return self.error("Choose To Read, Reading, or Completed.")
                    db.execute("INSERT INTO shelves VALUES(?,?,?,?) ON CONFLICT(user_id,book_id) DO UPDATE SET status=excluded.status,updated_at=excluded.updated_at",(uid,book_id,status,int(time.time())))
                    return self.send_json({"ok":True,"status":status})
                match = re.fullmatch(r"/api/books/([\w-]+)/reviews",path)
                if match and method == "POST":
                    book_id = match.group(1)
                    rating = payload.get("rating")
                    text = str(payload.get("text","")).strip()[:2000]
                    if not db.execute("SELECT 1 FROM books WHERE id=?",(book_id,)).fetchone():
                        return self.error("Book not found.",404)
                    if not isinstance(rating,int) or not 1<=rating<=5 or len(text)<3:
                        return self.error("Choose a 1–5 star rating and write at least 3 characters.")
                    now = int(time.time())
                    db.execute("INSERT INTO reviews(user_id,book_id,rating,text,created_at) VALUES(?,?,?,?,?) ON CONFLICT(user_id,book_id) DO UPDATE SET rating=excluded.rating,text=excluded.text,created_at=excluded.created_at",(uid,book_id,rating,text,now))
                    review = db.execute("SELECT id FROM reviews WHERE user_id=? AND book_id=?",(uid,book_id)).fetchone()
                    db.execute("INSERT INTO shelves VALUES(?,?,?,?) ON CONFLICT(user_id,book_id) DO NOTHING",(uid,book_id,"Completed",now))
                    db.execute("INSERT INTO notifications(recipient_id,actor_id,kind,entity_id,created_at) SELECT follower_id,?,?,?,? FROM follows WHERE followee_id=? AND follower_id!=?",(uid,"review",str(review["id"]),now,uid,uid))
                    return self.send_json({"ok":True,"review_id":review["id"]},201)
                match = re.fullmatch(r"/api/users/([\w-]+)/follow",path)
                if match and method in ("POST","DELETE"):
                    target = match.group(1)
                    if target == uid:
                        return self.error("You cannot follow yourself.")
                    if not db.execute("SELECT 1 FROM users WHERE id=?",(target,)).fetchone():
                        return self.error("Reader not found.",404)
                    if method == "POST":
                        db.execute("INSERT OR IGNORE INTO follows VALUES(?,?,?)",(uid,target,int(time.time())))
                        db.execute("INSERT INTO notifications(recipient_id,actor_id,kind,entity_id,created_at) VALUES(?,?,?,?,?)",(target,uid,"follow",uid,int(time.time())))
                    else:
                        db.execute("DELETE FROM follows WHERE follower_id=? AND followee_id=?",(uid,target))
                    return self.send_json({"ok":True,"following":method=="POST"})
                match = re.fullmatch(r"/api/reviews/(\d+)/like",path)
                if match and method == "POST":
                    review_id = int(match.group(1))
                    review = db.execute("SELECT user_id FROM reviews WHERE id=?",(review_id,)).fetchone()
                    if not review:
                        return self.error("Review not found.",404)
                    existing = db.execute("SELECT 1 FROM review_likes WHERE user_id=? AND review_id=?",(uid,review_id)).fetchone()
                    if existing:
                        db.execute("DELETE FROM review_likes WHERE user_id=? AND review_id=?",(uid,review_id)); liked=False
                    else:
                        db.execute("INSERT INTO review_likes VALUES(?,?,?)",(uid,review_id,int(time.time()))); liked=True
                        if review["user_id"] != uid:
                            db.execute("INSERT INTO notifications(recipient_id,actor_id,kind,entity_id,created_at) VALUES(?,?,?,?,?)",(review["user_id"],uid,"like",str(review_id),int(time.time())))
                    count = db.execute("SELECT COUNT(*) FROM review_likes WHERE review_id=?",(review_id,)).fetchone()[0]
                    return self.send_json({"liked":liked,"likes":count})
                match = re.fullmatch(r"/api/reviews/(\d+)/comments",path)
                if match and method == "POST":
                    review_id = int(match.group(1)); comment = str(payload.get("text","")).strip()[:1000]
                    review = db.execute("SELECT user_id FROM reviews WHERE id=?",(review_id,)).fetchone()
                    if not review:
                        return self.error("Review not found.",404)
                    if len(comment)<2:
                        return self.error("Write at least 2 characters.")
                    now = int(time.time())
                    cur = db.execute("INSERT INTO review_comments(user_id,review_id,text,created_at) VALUES(?,?,?,?)",(uid,review_id,comment,now))
                    if review["user_id"] != uid:
                        db.execute("INSERT INTO notifications(recipient_id,actor_id,kind,entity_id,created_at) VALUES(?,?,?,?,?)",(review["user_id"],uid,"comment",str(review_id),now))
                    return self.send_json({"id":cur.lastrowid,"text":comment,"created_at":now},201)
                if path == "/api/notifications/read" and method == "POST":
                    db.execute("UPDATE notifications SET read_at=? WHERE recipient_id=? AND read_at IS NULL",(int(time.time()),uid))
                    return self.send_json({"ok":True})
        except sqlite3.Error as exc:
            print("Database error:", exc)
            return self.error("Something went wrong. Please try again.",500)
        return self.error("Not found.",404)


def main():
    init_db()
    server = ThreadingHTTPServer((os.environ.get("HOST", "127.0.0.1"), PORT), MahinBookHandler)
    print(f"MahinBook API is listening at http://{server.server_address[0]}:{server.server_address[1]}")
    print(f"Database: {DB_PATH}")
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\nMahinBook stopped.")
    finally:
        server.server_close()


if __name__ == "__main__":
    main()
