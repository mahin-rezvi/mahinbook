const express = require('express');
const helmet = require('helmet');
const { rateLimit } = require('express-rate-limit');
const path = require('path');
const { createApiContext, createAuth } = require('./api/context');
const { createAuthRouter } = require('./api/routes/auth.routes');
const { createBooksRouter } = require('./api/routes/books.routes');
const { createShelvesRouter } = require('./api/routes/shelves.routes');
const { createCommunityRouter, createOptionalAuth } = require('./api/routes/community.routes');
const { createLibraryRouter } = require('./api/routes/library.routes');

function createApp(db) {
  const app = express();
  const context = createApiContext(db);
  const requireAuth = createAuth(context);
  const optionalAuth = createOptionalAuth(context);

  app.disable('x-powered-by');
  app.use(helmet({
    crossOriginResourcePolicy: { policy: 'cross-origin' },
    contentSecurityPolicy: { directives: {
      defaultSrc: ["'self'"], scriptSrc: ["'self'"], connectSrc: ["'self'"],
      imgSrc: ["'self'", 'data:', 'https://covers.openlibrary.org'],
      frameSrc: ["'self'", 'https:', 'blob:'],
      styleSrc: ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'],
      fontSrc: ["'self'", 'https://fonts.gstatic.com'], objectSrc: ["'none'"],
      baseUri: ["'self'"], frameAncestors: ["'none'"]
    } }
  }));
  app.use(express.json({ limit: '30kb' }));
  app.use(express.static(path.join(__dirname, '..', 'public')));

  const authLimiter = rateLimit({ windowMs: 15 * 60 * 1000, limit: 20,
    standardHeaders: 'draft-8', legacyHeaders: false,
    message: { error: 'Too many sign-in attempts. Please try again in a few minutes.' } });
  const authRouter = createAuthRouter(context, requireAuth);
  app.post('/api/auth/signup', authLimiter);
  app.post('/api/auth/login', authLimiter);
  app.use('/api', authRouter);
  app.use('/api/books', createBooksRouter(context, requireAuth));
  app.use('/api/lists', createShelvesRouter(context, requireAuth));
  app.use('/api/library', createLibraryRouter(context, requireAuth));
  app.use('/api', createCommunityRouter(context, requireAuth, optionalAuth));

  app.get('/api/health', (_req, res) => res.json({ status: 'ok', database: 'connected' }));
  app.get('/api/openapi.yaml', (_req, res) => res.sendFile(path.join(__dirname, '..', 'docs', 'openapi.yaml')));
  app.use('/api', (_req, res) => res.status(404).json({ error: 'API route not found.' }));
  app.get(/.*/, (_req, res) => res.sendFile(path.join(__dirname, '..', 'public', 'index.html')));
  app.use((err, _req, res, _next) => {
    console.error('Request failed:', err.message);
    return res.status(500).json({ error: 'Something went wrong. Please try again.' });
  });
  return app;
}

module.exports = { createApp };
