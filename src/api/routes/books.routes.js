const express = require('express');

function createBooksRouter(context, requireAuth) {
  const router = express.Router();
  const { collections, safeUser, asId, fail } = context;

  router.get('/', async (req, res) => {
    const q = String(req.query.q || '').trim();
    const genre = String(req.query.genre || '').trim();
    const filter = {};
    if (genre && genre !== 'All') filter.genre = genre;
    if (q) filter.$text = { $search: q };
    const items = await collections.books.find(filter).limit(60).toArray();
    const ratings = await collections.reviews.aggregate([
      { $group: { _id: '$bookId', avg: { $avg: '$rating' }, count: { $sum: 1 } } }
    ]).toArray();
    const ratingMap = new Map(ratings.map(r => [String(r._id), {
      averageRating: Math.round(r.avg * 10) / 10, reviewCount: r.count
    }]));
    return res.json(items.map(book => ({ ...book, id: book._id.toString(), ...ratingMap.get(String(book._id)) }))
      .map(({ _id, ...book }) => book));
  });

  router.get('/:id', async (req, res) => {
    const id = asId(req.params.id);
    if (!id) return fail(res, 404, 'Book not found.');
    const book = await collections.books.findOne({ _id: id });
    if (!book) return fail(res, 404, 'Book not found.');
    const rows = await collections.reviews.aggregate([
      { $match: { bookId: id } },
      { $lookup: { from: 'users', localField: 'userId', foreignField: '_id', as: 'author' } },
      { $unwind: '$author' }, { $sort: { createdAt: -1 } }
    ]).toArray();
    const average = rows.length ? rows.reduce((sum, row) => sum + row.rating, 0) / rows.length : 0;
    return res.json({
      ...book, id: book._id.toString(), averageRating: Math.round(average * 10) / 10,
      reviewCount: rows.length,
      reviews: rows.map(row => ({ id: row._id.toString(), rating: row.rating, comment: row.comment,
        createdAt: row.createdAt, user: safeUser(row.author) }))
    });
  });

  router.post('/:id/reviews', requireAuth, async (req, res) => {
    const bookId = asId(req.params.id);
    const rating = Number(req.body?.rating);
    const comment = String(req.body?.comment || '').trim().slice(0, 1400);
    if (!bookId || rating < 1 || rating > 5 || !Number.isInteger(rating) || comment.length < 2) {
      return fail(res, 400, 'Add a 1–5 star rating and a short review.');
    }
    if (!await collections.books.findOne({ _id: bookId })) return fail(res, 404, 'Book not found.');
    const review = { userId: req.user._id, bookId, rating, comment, createdAt: new Date() };
    const result = await collections.reviews.insertOne(review);
    await collections.activities.insertOne({ userId: req.user._id, kind: 'review', bookId,
      reviewId: result.insertedId, createdAt: review.createdAt });
    return res.status(201).json({ id: result.insertedId.toString(), rating, comment,
      createdAt: review.createdAt, user: safeUser(req.user) });
  });

  return router;
}

module.exports = { createBooksRouter };
