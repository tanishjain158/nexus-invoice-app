const express = require('express');
const morgan = require('morgan');
const cors = require('cors');
const path = require('path');

const db = require('./db'); // ensures DB is initialized on boot
const basicAuth = require('./middleware/auth');

const app = express();
app.use(morgan('dev'));
// Native apps (iOS/Android) aren't subject to browser CORS, but this also lets the mobile
// app be tested via `expo start --web` and keeps the door open for other browser clients.
app.use(cors());
app.use(basicAuth);
app.use(express.json({ limit: '5mb' }));

if (!process.env.APP_USERNAME || !process.env.APP_PASSWORD) {
  console.warn(
    '\n⚠  APP_USERNAME / APP_PASSWORD are not set — this app has NO login and anyone who can\n' +
    '   reach it can view and edit every invoice and customer record. Fine for local dev; set\n' +
    '   both before deploying anywhere reachable off your own machine.\n'
  );
}

app.use('/api/exporters', require('./routes/exporters'));
app.use('/api/products', require('./routes/products'));
app.use('/api/customers', require('./routes/customers'));
app.use('/api/invoices', require('./routes/invoices'));

// Unknown API routes get a JSON 404 (the frontend's API client expects JSON errors).
app.use('/api', (req, res) => res.status(404).json({ error: 'Not found' }));

app.use(express.static(path.join(__dirname, '..', 'public')));
// Single-page app: all client-side navigation uses #hash routes, so plain
// static serving of index.html at "/" is sufficient — no catch-all route needed.

// Anything a route throws (e.g. a SQLite constraint error) lands here as JSON instead of
// Express's default HTML error page.
app.use((err, req, res, next) => {
  if (res.headersSent) return next(err);
  const status = err.status || err.statusCode || (err.code && String(err.code).startsWith('SQLITE_CONSTRAINT') ? 400 : 500);
  if (status >= 500) console.error(err);
  res.status(status).json({ error: status >= 500 ? 'Internal server error' : err.message });
});

module.exports = app;

if (require.main === module) {
  const { closeBrowser } = require('./pdf/render');
  const PORT = process.env.PORT || 4000;
  const server = app.listen(PORT, () => {
    console.log(`NEXUS Invoice App listening on http://localhost:${PORT}`);
  });

  // Close the HTTP server, headless Chrome and the SQLite handle cleanly on docker stop / Ctrl-C.
  const shutdown = signal => {
    console.log(`${signal} received, shutting down…`);
    server.close(async () => {
      await closeBrowser();
      db.close();
      process.exit(0);
    });
    setTimeout(() => process.exit(1), 10000).unref();
  };
  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
}
