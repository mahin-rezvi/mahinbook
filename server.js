require('dotenv').config();
const { createApp } = require('./src/app');
const { createDatabase } = require('./src/config/database');

async function start() {
  if (!process.env.JWT_SECRET) throw new Error('JWT_SECRET is required. Add it to .env.');
  const database = createDatabase();
  const db = await database.connect();
  const app = createApp(db);
  const port = Number(process.env.PORT || 4000);
  const server = app.listen(port, () => console.log(`MahinBook is ready on http://localhost:${port}`));

  const shutdown = signal => {
    console.log(`${signal} received; closing server.`);
    server.close(async () => { await database.close(); process.exit(0); });
  };
  process.once('SIGINT', () => shutdown('SIGINT'));
  process.once('SIGTERM', () => shutdown('SIGTERM'));
}

start().catch(error => {
  console.error(`Startup failed: ${error.message}`);
  process.exit(1);
});
