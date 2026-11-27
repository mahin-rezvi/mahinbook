const { after, before, test } = require('node:test');
const assert = require('node:assert/strict');
const { randomUUID } = require('node:crypto');
const { createDatabase } = require('../src/config/database');
const { createApp } = require('../src/app');

process.env.MONGODB_URI ||= 'mongodb://127.0.0.1:27018';
process.env.MONGODB_DB = `mahinbook_test_${randomUUID().replaceAll('-', '')}`;
process.env.JWT_SECRET = 'integration-test-secret-at-least-32-characters';

let database;
let db;
let server;
let baseUrl;
let aliceToken;
let bobToken;
let aliceId;
let bobId;
let bookId;

async function request(path, { token, method = 'GET', body } = {}) {
  const response = await fetch(`${baseUrl}${path}`, {
    method,
    headers: {
      ...(body ? { 'Content-Type': 'application/json' } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {})
    },
    ...(body ? { body: JSON.stringify(body) } : {})
  });
  const type = response.headers.get('content-type') || '';
  return { response, data: type.includes('application/json') ? await response.json() : await response.text() };
}

async function uploadPdf(token, fields, contents = '%PDF-1.7\nPDF fixture\n%%EOF') {
  const body = new FormData();
  for (const [key, value] of Object.entries(fields)) body.append(key, value);
  body.append('file', new Blob([contents], { type: 'application/pdf' }), 'fixture.pdf');
  const response = await fetch(`${baseUrl}/api/library`, {
    method: 'POST', headers: { Authorization: `Bearer ${token}` }, body
  });
  return { response, data: await response.json() };
}

before(async () => {
  database = createDatabase();
  db = await database.connect();
  const app = createApp(db);
  await new Promise(resolve => { server = app.listen(0, '127.0.0.1', resolve); });
  baseUrl = `http://127.0.0.1:${server.address().port}`;
});

after(async () => {
  if (server) await new Promise(resolve => server.close(resolve));
  if (db) await db.dropDatabase();
  if (database) await database.close();
});

test('API integration: auth, books, profiles, shelves, reviews, follows, and feed', async t => {
  await t.test('health, web shell, and API routing', async () => {
    const health = await request('/api/health');
    assert.equal(health.response.status, 200);
    assert.deepEqual(health.data, { status: 'ok', database: 'connected' });
    const contract = await request('/api/openapi.yaml');
    assert.equal(contract.response.status, 200);
    assert.match(contract.data, /openapi: 3\.1\.0/);
    const shell = await request('/');
    assert.equal(shell.response.status, 200);
    assert.match(shell.data, /MahinBook/);
    assert.equal(shell.response.headers.get('x-powered-by'), null);
    const missing = await request('/api/no-such-route');
    assert.equal(missing.response.status, 404);
    assert.match(missing.data.error, /not found/i);
  });

  await t.test('catalog listing, genre/search filters, and book detail', async () => {
    const catalog = await request('/api/books');
    assert.equal(catalog.response.status, 200);
    assert.ok(catalog.data.length >= 12);
    const dune = catalog.data.find(book => book.title === 'Dune');
    assert.ok(dune);
    bookId = dune.id;
    assert.equal((await request('/api/books?q=Dune')).data[0].id, bookId);
    assert.ok((await request('/api/books?genre=Fantasy')).data.every(book => book.genre === 'Fantasy'));
    assert.equal((await request('/api/books/not-an-id')).response.status, 404);
    assert.equal((await request(`/api/books/${bookId}`)).data.title, 'Dune');
  });

  await t.test('signup validation, account creation, duplicate protection, and login', async () => {
    assert.equal((await request('/api/auth/signup', { method: 'POST', body: { name: 'A', email: 'bad', password: 'short' } })).response.status, 400);
    const alice = await request('/api/auth/signup', { method: 'POST', body: { name: 'Alice Reader', email: 'alice@example.test', password: 'shelf-password-1' } });
    assert.equal(alice.response.status, 201);
    aliceToken = alice.data.token;
    aliceId = alice.data.user.id;
    assert.equal((await request('/api/auth/signup', { method: 'POST', body: { name: 'Alice', email: 'ALICE@example.test', password: 'shelf-password-1' } })).response.status, 409);
    assert.equal((await request('/api/auth/login', { method: 'POST', body: { email: 'alice@example.test', password: 'wrong-password' } })).response.status, 401);
    const login = await request('/api/auth/login', { method: 'POST', body: { email: 'ALICE@example.test', password: 'shelf-password-1' } });
    assert.equal(login.response.status, 200);
    assert.equal(login.data.user.id, aliceId);
    assert.equal((await request('/api/me')).response.status, 401);
  });

  await t.test('profile read and edit', async () => {
    const me = await request('/api/me', { token: aliceToken });
    assert.equal(me.response.status, 200);
    assert.equal(me.data.email, 'alice@example.test');
    assert.equal((await request('/api/me', { token: aliceToken, method: 'PATCH', body: { name: 'X', bio: 'Hello' } })).response.status, 400);
    const updated = await request('/api/me', { token: aliceToken, method: 'PATCH', body: { name: 'Alice W.', bio: 'Fantasy fan.' } });
    assert.equal(updated.data.name, 'Alice W.');
    assert.equal(updated.data.bio, 'Fantasy fan.');
  });

  await t.test('private shelf CRUD and status validation', async () => {
    assert.equal((await request('/api/lists', { token: aliceToken })).data.length, 0);
    assert.equal((await request(`/api/lists/${bookId}`, { token: aliceToken, method: 'PUT', body: { status: 'Unknown' } })).response.status, 400);
    assert.equal((await request(`/api/lists/${bookId}`, { token: aliceToken, method: 'PUT', body: { status: 'Reading' } })).response.status, 200);
    let list = await request('/api/lists', { token: aliceToken });
    assert.equal(list.data.length, 1);
    assert.equal(list.data[0].book.id, bookId);
    assert.equal(list.data[0].status, 'Reading');
    await request(`/api/lists/${bookId}`, { token: aliceToken, method: 'PUT', body: { status: 'Completed' } });
    list = await request('/api/lists', { token: aliceToken });
    assert.equal(list.data[0].status, 'Completed');
    assert.equal((await request(`/api/lists/${bookId}`, { token: aliceToken, method: 'DELETE' })).response.status, 200);
    assert.equal((await request('/api/lists', { token: aliceToken })).data.length, 0);
  });

  await t.test('review validation, persistence, and aggregate rating', async () => {
    assert.equal((await request(`/api/books/${bookId}/reviews`, { token: aliceToken, method: 'POST', body: { rating: 9, comment: 'No' } })).response.status, 400);
    const review = await request(`/api/books/${bookId}/reviews`, { token: aliceToken, method: 'POST', body: { rating: 5, comment: 'A wonderful journey.' } });
    assert.equal(review.response.status, 201);
    const detail = await request(`/api/books/${bookId}`);
    assert.equal(detail.data.averageRating, 5);
    assert.equal(detail.data.reviewCount, 1);
    assert.equal(detail.data.reviews[0].user.id, aliceId);
    assert.equal((await request('/api/books')).data.find(book => book.id === bookId).averageRating, 5);
  });

  await t.test('reader discovery, following, and activity feed', async () => {
    const bob = await request('/api/auth/signup', { method: 'POST', body: { name: 'Bob Reader', email: 'bob@example.test', password: 'shelf-password-2' } });
    assert.equal(bob.response.status, 201);
    bobToken = bob.data.token;
    bobId = bob.data.user.id;
    const people = await request('/api/people', { token: bobToken });
    assert.ok(people.data.some(person => person.id === aliceId));
    assert.ok(people.data.every(person => !Object.hasOwn(person, 'email')));
    assert.equal((await request(`/api/people/${bobId}/follow`, { token: bobToken, method: 'PUT' })).response.status, 400);
    assert.equal((await request(`/api/people/${aliceId}/follow`, { token: bobToken, method: 'PUT' })).response.status, 200);
    assert.equal((await request(`/api/people/${aliceId}/follow`, { token: bobToken, method: 'PUT' })).response.status, 200);
    assert.equal(await db.collection('follows').countDocuments(), 1);
    assert.equal(await db.collection('activities').countDocuments({ userId: (await db.collection('users').findOne({ email: 'bob@example.test' }))._id, kind: 'follow' }), 1);
    const followedPeople = await request('/api/people', { token: bobToken });
    assert.equal(followedPeople.data.find(person => person.id === aliceId).followed, true);
    const feed = await request('/api/feed', { token: bobToken });
    assert.equal(feed.response.status, 200);
    assert.ok(feed.data.some(item => item.kind === 'review' && item.user.id === aliceId && item.book.id === bookId));
    assert.equal((await request('/api/feed')).response.status, 401);
    assert.equal((await request(`/api/people/${aliceId}/follow`, { token: bobToken, method: 'DELETE' })).data.following, false);
  });

  await t.test('private PDF uploads, book links, reader stream, and deletion', async () => {
    assert.equal((await request('/api/library')).response.status, 401);
    assert.equal((await request('/api/library', { token: aliceToken, method: 'POST', body: {
      title: 'Bad link', author: 'Alice', url: 'http://example.test/book.pdf'
    } })).response.status, 400);
    const badPdf = await uploadPdf(aliceToken, { title: 'Broken PDF', author: 'Reader' }, 'not a pdf');
    assert.equal(badPdf.response.status, 400);
    const linked = await request('/api/library', { token: aliceToken, method: 'POST', body: {
      title: 'Linked book', author: 'Reader', url: 'https://example.test/book.pdf', genre: 'Fiction'
    } });
    assert.equal(linked.response.status, 201);
    assert.equal(linked.data.sourceType, 'link');
    assert.equal((await request(`/api/library/${linked.data.id}`, { token: bobToken })).response.status, 404);

    const uploaded = await uploadPdf(aliceToken, { title: 'My PDF', author: 'Reader', genre: 'Memoir' });
    assert.equal(uploaded.response.status, 201);
    assert.equal(uploaded.data.sourceType, 'upload');
    assert.equal(uploaded.data.size, Buffer.byteLength('%PDF-1.7\nPDF fixture\n%%EOF'));
    assert.equal((await request(`/api/library/${uploaded.data.id}/file`, { token: bobToken })).response.status, 404);
    const file = await request(`/api/library/${uploaded.data.id}/file`, { token: aliceToken });
    assert.equal(file.response.status, 200);
    assert.match(file.response.headers.get('content-type'), /application\/pdf/);
    assert.match(file.data, /^%PDF-1\.7/);
    assert.equal((await request('/api/library', { token: aliceToken })).data.length, 2);
    assert.equal((await request(`/api/library/${linked.data.id}`, { token: aliceToken, method: 'DELETE' })).response.status, 200);
    assert.equal((await request(`/api/library/${uploaded.data.id}`, { token: aliceToken, method: 'DELETE' })).response.status, 200);
    assert.equal((await request('/api/library', { token: aliceToken })).data.length, 0);
    assert.equal(await db.collection('bookFiles.files').countDocuments(), 0);
  });
});
