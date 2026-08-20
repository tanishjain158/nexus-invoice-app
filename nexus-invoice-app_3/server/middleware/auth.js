const crypto = require('crypto');

// Constant-time string comparison so a wrong guess can't be timed to find out
// how many leading characters it got right.
function safeEqual(a, b) {
  const bufA = Buffer.from(String(a));
  const bufB = Buffer.from(String(b));
  if (bufA.length !== bufB.length) {
    crypto.timingSafeEqual(bufA, bufA); // burn the same time as a real comparison
    return false;
  }
  return crypto.timingSafeEqual(bufA, bufB);
}

// HTTP Basic Auth gate for the whole app, controlled by APP_USERNAME / APP_PASSWORD.
// If either is unset, auth is skipped entirely — convenient for local development, but that
// means anyone who can reach the app can see and edit every invoice and customer record. Set
// both env vars before deploying anywhere reachable off your own machine.
function basicAuth(req, res, next) {
  const user = process.env.APP_USERNAME;
  const pass = process.env.APP_PASSWORD;
  if (!user || !pass) return next();

  const header = req.headers.authorization || '';
  const [scheme, encoded] = header.split(' ');
  if (scheme === 'Basic' && encoded) {
    let decoded = '';
    try { decoded = Buffer.from(encoded, 'base64').toString('utf8'); } catch (e) { /* fall through to 401 */ }
    const sep = decoded.indexOf(':');
    if (sep !== -1) {
      const reqUser = decoded.slice(0, sep);
      const reqPass = decoded.slice(sep + 1);
      if (safeEqual(reqUser, user) && safeEqual(reqPass, pass)) return next();
    }
  }
  res.set('WWW-Authenticate', 'Basic realm="NEXUS Invoice System", charset="UTF-8"');
  res.status(401).send('Authentication required.');
}

module.exports = basicAuth;
