const jwt = require('jsonwebtoken');
const { GridFSBucket, ObjectId } = require('mongodb');

function createApiContext(db) {
  const collections = {
    users: db.collection('users'),
    books: db.collection('books'),
    reviews: db.collection('reviews'),
    lists: db.collection('readingLists'),
    follows: db.collection('follows'),
    activities: db.collection('activities'),
    userBooks: db.collection('userBooks')
  };

  return {
    collections,
    bucket: new GridFSBucket(db, { bucketName: 'bookFiles' }),
    safeUser: user => ({
      id: user._id.toString(), name: user.name, email: user.email,
      bio: user.bio || '', avatar: user.avatar || '', createdAt: user.createdAt
    }),
    tokenFor: user => jwt.sign({ sub: user._id.toString() }, process.env.JWT_SECRET, { expiresIn: '14d' }),
    asId: value => ObjectId.isValid(value) ? new ObjectId(value) : null,
    userIdFromToken(token) {
      try { return new ObjectId(jwt.verify(token, process.env.JWT_SECRET).sub); } catch { return null; }
    },
    fail: (res, status, error) => res.status(status).json({ error })
  };
}

function createAuth(context) {
  return async function requireAuth(req, res, next) {
    try {
      const token = (req.headers.authorization || '').replace(/^Bearer\s+/i, '');
      const payload = jwt.verify(token, process.env.JWT_SECRET);
      req.user = await context.collections.users.findOne({ _id: new ObjectId(payload.sub) });
      if (!req.user) return res.status(401).json({ error: 'Please sign in again.' });
      return next();
    } catch {
      return res.status(401).json({ error: 'Please sign in to continue.' });
    }
  };
}

module.exports = { createApiContext, createAuth };
