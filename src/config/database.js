const { MongoClient } = require('mongodb');
const { starterCatalog } = require('../data/catalog');

function createDatabase() {
  const uri = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017';
  const client = new MongoClient(uri, {
    serverSelectionTimeoutMS: Number(process.env.MONGO_SERVER_SELECTION_TIMEOUT_MS || 10000),
    maxPoolSize: Number(process.env.MONGO_MAX_POOL_SIZE || 20)
  });

  return {
    client,
    async connect() {
      await client.connect();
      const db = client.db(process.env.MONGODB_DB || undefined);
      await createIndexes(db);
      await seedCatalog(db);
      return db;
    },
    close: () => client.close()
  };
}

async function createIndexes(db) {
  await Promise.all([
    db.collection('users').createIndex({ email: 1 }, { unique: true }),
    db.collection('books').createIndex({ title: 'text', author: 'text', description: 'text' }),
    db.collection('readingLists').createIndex({ userId: 1, bookId: 1 }, { unique: true }),
    db.collection('follows').createIndex({ followerId: 1, followeeId: 1 }, { unique: true }),
    db.collection('reviews').createIndex({ bookId: 1, createdAt: -1 }),
    db.collection('activities').createIndex({ userId: 1, createdAt: -1 }),
    db.collection('userBooks').createIndex({ ownerId: 1, createdAt: -1 })
  ]);
}

async function seedCatalog(db) {
  if (process.env.SEED_CATALOG === 'false') return;
  const books = db.collection('books');
  if (await books.countDocuments() === 0) await books.insertMany(starterCatalog);
}

module.exports = { createDatabase, createIndexes, seedCatalog };
