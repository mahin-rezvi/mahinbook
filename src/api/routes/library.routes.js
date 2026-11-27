const express = require('express');
const multer = require('multer');
const { finished } = require('node:stream/promises');
const path = require('node:path');

const MAX_FILE_SIZE = 25 * 1024 * 1024;
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_FILE_SIZE, files: 1 },
  fileFilter(_req, file, done) {
    if (file.mimetype !== 'application/pdf' || path.extname(file.originalname).toLowerCase() !== '.pdf') {
      return done(new multer.MulterError('LIMIT_UNEXPECTED_FILE', 'file'));
    }
    return done(null, true);
  }
});

function uploadPdf(req, res, next) {
  upload.single('file')(req, res, error => {
    if (!error) return next();
    const status = error.code === 'LIMIT_FILE_SIZE' ? 413 : 400;
    return res.status(status).json({ error: status === 413 ? 'PDF files must be 25 MB or smaller.' : 'Choose one PDF file.' });
  });
}

const toPublicBook = row => ({
  id: row._id.toString(), title: row.title, author: row.author,
  description: row.description || '', genre: row.genre || 'Other',
  sourceType: row.sourceType, size: row.size || null, sourceUrl: row.sourceUrl || null,
  createdAt: row.createdAt
});

function validateHttpsLink(value) {
  try {
    const url = new URL(value);
    if (url.protocol !== 'https:' || !url.hostname || url.username || url.password) return null;
    if (['localhost', '127.0.0.1', '::1'].includes(url.hostname.toLowerCase())) return null;
    return url.toString();
  } catch { return null; }
}

function createLibraryRouter(context, requireAuth) {
  const router = express.Router();
  const { collections, bucket, asId, fail } = context;

  router.get('/', requireAuth, async (req, res) => {
    const rows = await collections.userBooks.find({ ownerId: req.user._id }).sort({ createdAt: -1 }).toArray();
    return res.json(rows.map(toPublicBook));
  });

  router.post('/', requireAuth, uploadPdf, async (req, res) => {
    const title = String(req.body?.title || '').trim().slice(0, 140);
    const author = String(req.body?.author || '').trim().slice(0, 100);
    const description = String(req.body?.description || '').trim().slice(0, 2000);
    const genre = String(req.body?.genre || 'Other').trim().slice(0, 40) || 'Other';
    const sourceUrlInput = String(req.body?.url || '').trim();
    if (title.length < 1 || author.length < 1) return fail(res, 400, 'Add the book title and author.');
    if (Boolean(req.file) === Boolean(sourceUrlInput)) return fail(res, 400, 'Upload one PDF or provide one HTTPS book file link.');

    const row = { ownerId: req.user._id, title, author, description, genre, createdAt: new Date() };
    if (req.file) {
      if (req.file.buffer.length < 5 || req.file.buffer.subarray(0, 5).toString('ascii') !== '%PDF-') {
        return fail(res, 400, 'This file does not look like a valid PDF.');
      }
      const filename = path.basename(req.file.originalname).replace(/[^\w.-]/g, '_').slice(0, 120) || 'book.pdf';
      const stream = bucket.openUploadStream(filename, {
        contentType: 'application/pdf', metadata: { ownerId: req.user._id, title }
      });
      stream.end(req.file.buffer);
      await finished(stream);
      row.sourceType = 'upload';
      row.fileId = stream.id;
      row.size = req.file.size;
    } else {
      const sourceUrl = validateHttpsLink(sourceUrlInput);
      if (!sourceUrl) return fail(res, 400, 'Use a valid HTTPS link without a username or password.');
      row.sourceType = 'link';
      row.sourceUrl = sourceUrl;
    }

    try {
      const result = await collections.userBooks.insertOne(row);
      row._id = result.insertedId;
      return res.status(201).json(toPublicBook(row));
    } catch (error) {
      if (row.fileId) await bucket.delete(row.fileId).catch(() => {});
      throw error;
    }
  });

  router.get('/:id/file', requireAuth, async (req, res) => {
    const id = asId(req.params.id);
    if (!id) return fail(res, 404, 'Book file not found.');
    const row = await collections.userBooks.findOne({ _id: id, ownerId: req.user._id, sourceType: 'upload' });
    if (!row) return fail(res, 404, 'Book file not found.');
    res.set({
      'Content-Type': 'application/pdf', 'Content-Disposition': 'inline',
      'Cache-Control': 'private, no-store', 'X-Content-Type-Options': 'nosniff'
    });
    const stream = bucket.openDownloadStream(row.fileId);
    stream.on('error', error => {
      if (!res.headersSent) fail(res, error.code === 'ENOENT' ? 404 : 500, 'Book file could not be opened.');
      else res.destroy(error);
    });
    stream.pipe(res);
  });

  router.get('/:id', requireAuth, async (req, res) => {
    const id = asId(req.params.id);
    if (!id) return fail(res, 404, 'Book not found.');
    const row = await collections.userBooks.findOne({ _id: id, ownerId: req.user._id });
    if (!row) return fail(res, 404, 'Book not found.');
    return res.json(toPublicBook(row));
  });

  router.delete('/:id', requireAuth, async (req, res) => {
    const id = asId(req.params.id);
    if (!id) return fail(res, 404, 'Book not found.');
    const row = await collections.userBooks.findOne({ _id: id, ownerId: req.user._id });
    if (!row) return fail(res, 404, 'Book not found.');
    await collections.userBooks.deleteOne({ _id: id, ownerId: req.user._id });
    if (row.fileId) await bucket.delete(row.fileId).catch(error => { if (error.code !== 'ENOENT') throw error; });
    return res.json({ ok: true });
  });

  return router;
}

module.exports = { createLibraryRouter, MAX_FILE_SIZE };
