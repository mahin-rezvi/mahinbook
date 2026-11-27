const express = require('express');

function createCommunityRouter(context, requireAuth, optionalAuth) {
  const router = express.Router();
  const { collections, safeUser, asId, fail } = context;

  router.get('/people', optionalAuth, async (req, res) => {
    const { users, follows, reviews, lists } = collections;
    const rows = await users.find({}, { projection: { passwordHash: 0, email: 0 } })
      .sort({ createdAt: -1 }).limit(24).toArray();
    const people = await Promise.all(rows.map(async user => {
      const [reviewCount, bookCount, followed] = await Promise.all([
        reviews.countDocuments({ userId: user._id }), lists.countDocuments({ userId: user._id }),
        req.user ? follows.findOne({ followerId: req.user._id, followeeId: user._id }) : null
      ]);
      return { ...safeUser(user), stats: { reviews: reviewCount, books: bookCount }, followed: Boolean(followed) };
    }));
    return res.json(people);
  });

  router.put('/people/:id/follow', requireAuth, async (req, res) => {
    const followeeId = asId(req.params.id);
    if (!followeeId || followeeId.equals(req.user._id)) return fail(res, 400, 'You cannot follow this account.');
    const { users, follows, activities } = collections;
    if (!await users.findOne({ _id: followeeId })) return fail(res, 404, 'Reader not found.');
    const result = await follows.updateOne({ followerId: req.user._id, followeeId },
      { $setOnInsert: { createdAt: new Date() } }, { upsert: true });
    if (result.upsertedCount) {
      await activities.insertOne({ userId: req.user._id, kind: 'follow', followeeId, createdAt: new Date() });
    }
    return res.json({ following: true });
  });

  router.delete('/people/:id/follow', requireAuth, async (req, res) => {
    const followeeId = asId(req.params.id);
    if (!followeeId) return fail(res, 404, 'Reader not found.');
    await collections.follows.deleteOne({ followerId: req.user._id, followeeId });
    return res.json({ following: false });
  });

  router.get('/feed', requireAuth, async (req, res) => {
    const { follows, activities, books, users, reviews } = collections;
    const edges = await follows.find({ followerId: req.user._id }).toArray();
    const ids = edges.map(edge => edge.followeeId);
    if (!ids.length) return res.json([]);
    const rows = await activities.find({ userId: { $in: ids } }).sort({ createdAt: -1 }).limit(30).toArray();
    const items = await Promise.all(rows.map(async activity => {
      const [person, book, review, followee] = await Promise.all([
        users.findOne({ _id: activity.userId }),
        activity.bookId ? books.findOne({ _id: activity.bookId }) : null,
        activity.reviewId ? reviews.findOne({ _id: activity.reviewId }) : null,
        activity.followeeId ? users.findOne({ _id: activity.followeeId }) : null
      ]);
      if (!person) return null;
      return {
        id: activity._id.toString(), kind: activity.kind, status: activity.status,
        rating: review?.rating, comment: review?.comment, createdAt: activity.createdAt,
        user: safeUser(person),
        book: book ? { id: book._id.toString(), title: book.title, author: book.author, coverUrl: book.coverUrl } : null,
        followee: followee ? safeUser(followee) : null
      };
    }));
    return res.json(items.filter(Boolean));
  });

  return router;
}

function createOptionalAuth(context) {
  return async (req, _res, next) => {
    const token = (req.headers.authorization || '').replace(/^Bearer\s+/i, '');
    const userId = context.userIdFromToken(token);
    req.user = userId ? await context.collections.users.findOne({ _id: userId }) : null;
    next();
  };
}

module.exports = { createCommunityRouter, createOptionalAuth };
