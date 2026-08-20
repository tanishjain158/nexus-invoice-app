// Uses puppeteer-core as the driver (identical API to full puppeteer for launch/newPage/pdf),
// but resolves *which* Chromium binary to launch from whatever's actually available — a system
// install (Docker/VPS, where Chromium is apt-installed to keep the image lean) or, failing
// that, the bundled Chromium that the full `puppeteer` package downloads on `npm install` (the
// case for a plain Node deploy with no Dockerfile, e.g. Render's non-Docker web service type).
const puppeteer = require('puppeteer-core');
const { buildFullHtml } = require('./templates');
const styles = require('./styles');

const CHROME_CANDIDATES = [
  process.env.CHROME_PATH,
  '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
  '/usr/bin/chromium-browser',
  '/usr/bin/chromium',
  '/usr/bin/google-chrome',
].filter(Boolean);

function findChrome() {
  const fs = require('fs');
  for (const p of CHROME_CANDIDATES) {
    if (fs.existsSync(p)) return p;
  }
  // No system Chromium found — fall back to full puppeteer's own bundled download, if that
  // package is installed (see package.json; PUPPETEER_SKIP_DOWNLOAD=true skips this for Docker
  // builds that already have a system Chromium, so it stays undefined/unused there).
  try {
    return require('puppeteer').executablePath();
  } catch (e) {
    return CHROME_CANDIDATES[0];
  }
}

let browserPromise = null;
function launchBrowser() {
  return puppeteer.launch({
    executablePath: findChrome(),
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });
}

// Reuses one browser instance across requests (launching Chrome per-PDF would be slow), but
// verifies it's still alive first — a long-lived headless Chrome process can crash or get
// reaped between requests (OOM, container restarts, etc.), and without this check every PDF
// request after that would fail forever with "Connection closed" until the whole server was
// restarted, since the dead browser stayed cached.
async function getBrowser() {
  if (browserPromise) {
    const existing = await browserPromise;
    if (existing.connected) return existing;
    browserPromise = null;
  }
  browserPromise = launchBrowser();
  return browserPromise;
}

async function renderInvoicePdf(full) {
  const html = buildFullHtml(full, styles);
  let browser = await getBrowser();
  let page;
  try {
    page = await browser.newPage();
  } catch (e) {
    // Browser died between the connected-check above and this call (rare race) — relaunch
    // once and retry rather than surfacing a 500 for a transient crash.
    browserPromise = null;
    browser = await getBrowser();
    page = await browser.newPage();
  }
  try {
    await page.setContent(html, { waitUntil: 'load' });
    const buffer = await page.pdf({
      format: 'A4',
      printBackground: true,
      preferCSSPageSize: true,
    });
    return buffer;
  } finally {
    await page.close().catch(() => {});
  }
}

module.exports = { renderInvoicePdf };
