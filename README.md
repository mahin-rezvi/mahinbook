# MahinBook

A responsive social bookshelf for discovering books, keeping a reading list, writing reviews, and following other readers. The web app is installable as a PWA and caches its app shell and recently loaded books for offline browsing.

## Run locally

1. Copy `.env.example` to `.env` and set `MONGODB_URI` and a long random `JWT_SECRET`.
2. Install dependencies with `npm install`.
3. Start the app with `npm run dev` (or `npm start`).
4. Open <http://localhost:4000>.

The first start creates the required MongoDB indexes and adds a starter catalog if the books collection is empty. Set `MONGODB_DB` to select a database explicitly; otherwise the URI's default database is used. The API and web UI share the same origin.

## API structure

- `src/api/routes/` contains separate routers for auth/profile, books/reviews, shelves, and community/feed.
- `src/api/context.js` shares database collections, authentication, and response helpers with route modules.
- `src/config/database.js` owns MongoDB connection settings, indexes, and starter catalog seeding.
- `src/app.js` composes middleware and route modules; `server.js` starts and gracefully closes the app.
- `test/api.integration.test.js` exercises the full API against a disposable local MongoDB database.

## Included

- Email and password signup/login with bcrypt password hashes and signed bearer tokens.
- Searchable starter catalog, book details, ratings and reviews.
- Personal To Read, Reading, and Completed shelves.
- Reader discovery, following, and an activity feed.
- A private reading room for PDF uploads (up to 25 MB) and HTTPS book file links, with an in-app reader.
- Editable reader profile, responsive mobile navigation, and installable web app shell.
- UI strings kept in the frontend source and starter book metadata stored in MongoDB.

The catalog starts with a small sample set; cover art is requested from Open Library. Native iOS and Android packages, push delivery, and a production OAuth provider are not included in this web MVP.

## Configuration

See `.env.example`. Keep `.env` private. Never put database credentials or token-signing secrets in `public/` or client-side JavaScript.

Run `npm test` with a MongoDB server available at `mongodb://127.0.0.1:27018` (or set `MONGODB_URI` to a disposable test database). The integration suite drops only its uniquely named test database when it finishes.
