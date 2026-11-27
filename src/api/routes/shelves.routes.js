const express = require('express');

function createShelvesRouter(context, requireAuth) {
  const router = express.Router();
  const { collections, asId, fail } = context;

  router.get('/', requireAuth, async (req, res) => {
    const rows = await collections.lists.aggregate([
      { $match: { userId: req.user._id } },
      { $lookup: { from: 'books', localField: 'bookId', foreignField: '_id', as: 'book' } },
      { $unwind: '$book' }, { $sort: { updatedAt: -1 } }
    ]).toArray();
    return res.json(rows.map(row => ({ id: row._id.toString(), status: row.status,
      addedAt: row.addedAt, book: { ...row.book, id: row.book._id.toString() } })));
  });

  router.put('/:bookId', requireAuth, async (req, res) => {
    const bookId = asId(req.params.bookId);
    const status = String(req.body?.status || '');
    if (!bookId || !['To Read', 'Reading', 'Completed'].includes(status)) {
      return fail(res, 400, 'Choose a valid reading status.');
    }
    if (!await collections.books.findOne({ _id: bookId })) return fail(res, 404, 'Book not found.');
    const now = new Date();
    await collections.lists.updateOne({ userId: req.user._id, bookId }, {
      $set: { status, updatedAt: now }, $setOnInsert: { addedAt: now }
    }, { upsert: true });
    await collections.activities.insertOne({ userId: req.user._id, kind: 'list', bookId, status, createdAt: now });
    return res.json({ ok: true, status });
  });

  router.delete('/:bookId', requireAuth, async (req, res) => {
    const bookId = asId(req.params.bookId);
    if (!bookId) return fail(res, 404, 'Book not found.');
    await collections.lists.deleteOne({ userId: req.user._id, bookId });
    return res.json({ ok: true });
  });

  return router;
}

module.exports = { createShelvesRouter };
