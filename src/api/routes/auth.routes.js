const express = require('express');
const bcrypt = require('bcryptjs');

function createAuthRouter(context, requireAuth) {
  const router = express.Router();
  const { collections, safeUser, tokenFor, fail } = context;

  router.post('/auth/signup', async (req, res) => {
    const name = String(req.body?.name || '').trim().slice(0, 48);
    const email = String(req.body?.email || '').trim().toLowerCase();
    const password = String(req.body?.password || '');
    if (name.length < 2 || !/^\S+@\S+\.\S+$/.test(email) || password.length < 8) {
      return fail(res, 400, 'Enter a name, a valid email, and a password with at least 8 characters.');
    }
    if (await collections.users.findOne({ email })) return fail(res, 409, 'An account with this email already exists.');
    const user = { name, email, passwordHash: await bcrypt.hash(password, 12), bio: '', avatar: '', createdAt: new Date() };
    const result = await collections.users.insertOne(user);
    user._id = result.insertedId;
    return res.status(201).json({ token: tokenFor(user), user: safeUser(user) });
  });

  router.post('/auth/login', async (req, res) => {
    const email = String(req.body?.email || '').trim().toLowerCase();
    const user = await collections.users.findOne({ email });
    if (!user || !await bcrypt.compare(String(req.body?.password || ''), user.passwordHash)) {
      return fail(res, 401, 'Email or password is incorrect.');
    }
    return res.json({ token: tokenFor(user), user: safeUser(user) });
  });

  router.get('/me', requireAuth, async (req, res) => {
    const { lists, reviews, follows } = collections;
    const [books, reviewCount, followingCount, followerCount] = await Promise.all([
      lists.countDocuments({ userId: req.user._id }), reviews.countDocuments({ userId: req.user._id }),
      follows.countDocuments({ followerId: req.user._id }), follows.countDocuments({ followeeId: req.user._id })
    ]);
    return res.json({ ...safeUser(req.user), stats: { books, reviews: reviewCount, following: followingCount, followers: followerCount } });
  });

  router.patch('/me', requireAuth, async (req, res) => {
    const name = String(req.body?.name || '').trim().slice(0, 48);
    const bio = String(req.body?.bio || '').trim().slice(0, 240);
    if (name.length < 2) return fail(res, 400, 'Name must be at least 2 characters.');
    await collections.users.updateOne({ _id: req.user._id }, { $set: { name, bio } });
    Object.assign(req.user, { name, bio });
    return res.json(safeUser(req.user));
  });

  return router;
}

module.exports = { createAuthRouter };
