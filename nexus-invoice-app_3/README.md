# NEXUS Export Invoice System

A self-hosted web app for generating NEXUS's Export Commercial Invoice, Packing List and
Annexure-to-Packing-List documents — matching the layout of `NXUAE0126` — with a real
database behind it, a product catalog for your animal feed supplements, and per-customer
invoice history lookup.

## What it does

- **Product catalog** — pre-loaded with all **80 NEXUS products**: the 6 export supplements
  from the sample invoice (Ionlyte C-40, X-Lyte C, Nutrix Platina, Grownex Forte, Minza Gold,
  Toxisorb) plus all 74 products from the full NEXUS Healthcare product catalogue (herbal
  supplements, vitamins, probiotics, enzymes, disinfectants, toxin binders, liver tonics, pet
  supplements, aqua products, and more — grouped into 18 categories, searchable, with each
  product's description, features & benefits, and dosage/feed inclusion rate carried over from
  the catalogue). Pick a product on an invoice line and its pack size, dimensions, weights and
  batch prefix fill in automatically — this is what makes "No. & Kind of Pkg" and the rest of
  the description change per shipment instead of being hardcoded.
  - The 74 catalogue products were imported with their reference info (description, features,
    dosage, "Presentation") but **without export packing specs** — the catalogue doesn't list
    carton dimensions or per-carton weight, since that's shipment logistics, not a product
    spec. Each of those products is flagged **"needs setup"** in the Product Catalog until you
    fill in dimensions/units-per-package/net & gross weight/CIF rate (a one-time step per
    product, done right on its edit form); after that it's flagged **"ready"** and behaves like
    the original 6. The invoice form also shows an inline warning if you add a "needs setup"
    product to a line before its packing details are filled in.
- **Customers** — store each consignee/buyer once (address, final destination, port of
  discharge, default delivery/payment terms). Open a customer's page and you get every
  invoice ever raised for them, with totals and one-click PDF downloads — the "fill in
  customer details, get their invoice history" behaviour you asked for.
- **Invoices** — a guided form for shipment details (vessel, ports, container/seal numbers,
  bank & payment terms, freight/insurance) and line items. Totals, package counts, and
  net/gross weight are calculated live as you add products. Any line item can be split across
  multiple packing rows with "+ Split packaging" — e.g. the sample invoice's Toxisorb line,
  shipped as 133 full cartons of 30 units plus 1 partial carton of 10 — and the annexure's box
  numbering (`F851 to F983`, `F984 to F984`, etc.) is computed correctly across every split.
- **PDF generation** — every invoice produces a single PDF containing the Export Commercial
  Invoice, the Packing List, and the Annexure (with box-range numbering like `F1 to F150`),
  paginated the same way as the original template, including the CIF breakdown and
  amount-in-words on the final invoice page.
- **Auto invoice numbering** — continues your `NXUAE####` sequence automatically.

## Mobile app

There's a companion native iOS/Android app (`nexus-mobile-app`, built with Expo/React
Native) that talks to this same backend — same database, same invoices, same product
catalog, kept in sync automatically since both apps read from this one server. See its own
README for setup, testing with Expo Go, and building a real installable app. This backend
already has CORS enabled (`server/app.js`) so the mobile app (and Expo's web preview) can
reach it.

## Requirements

- Node.js 18+ (tested on Node 22)
- A Chromium/Chrome binary for PDF generation (see below)

## Setup

```bash
cd nexus-invoice-app
npm install
```

PDF generation uses Puppeteer in "core" mode (no bundled Chromium download), so it needs a
Chrome/Chromium binary on the machine you run it on. By default it looks for:

1. `CHROME_PATH` environment variable, if set
2. A few common install locations (`/usr/bin/chromium-browser`, `/usr/bin/chromium`,
   `/usr/bin/google-chrome`)

If you don't already have Chrome/Chromium installed, install it with your OS package manager
(e.g. `sudo apt install chromium-browser` on Debian/Ubuntu, or `brew install chromium` on
macOS), or set `CHROME_PATH` to point at whatever Chrome install you have.

## Running it

```bash
npm start
```

Then open **http://localhost:4000** in a browser. The app serves both the API and the
frontend from the same server, and stores everything in a SQLite file database at
`data/nexus.db` (created automatically on first run, pre-seeded with NEXUS's details, the full
80-product catalog, and one sample customer).

The catalog seed step (`server/db/catalog_data.js`, generated from the NEXUS product
catalogue PDF) only inserts products that aren't already in the database by name, and runs on
every boot — so it's safe, and it means dropping a newer `catalog_data.js` in later (e.g. after
the catalogue is updated) will pick up any new products without touching ones you've already
customized.

To run on a different port: `PORT=5000 npm start`.

### Logging in

By default the app has **no login** — fine while it's only running on your own machine.
Before it's reachable by anyone else, set `APP_USERNAME` and `APP_PASSWORD` (see
`.env.example`) and every page and API route is gated behind an HTTP Basic Auth prompt.
Leaving them unset on a public deployment means anyone with the URL can view and edit every
invoice, customer, and bank detail — the app prints a warning on startup if that's the case.

## Deploying

The app ships with everything needed to deploy as a single Docker container: a `Dockerfile`
(installs Chromium alongside Node so PDF generation works out of the box), a
`docker-compose.yml` for running it yourself, and a `render.yaml` blueprint for Render. Pick
whichever fits:

### Option A — Docker, on any VPS or your own machine (recommended if you want full control)

```bash
cp .env.example .env    # then edit .env and set a real APP_USERNAME / APP_PASSWORD
docker compose up -d --build
```

That builds the image, starts the app on port 4000, and mounts `./data` on the host so the
database survives container restarts and rebuilds. Put a reverse proxy in front of it for
HTTPS and a real domain — [Caddy](https://caddyserver.com) is the easiest option; point it at
`localhost:4000` and give it a domain name, and it handles the TLS certificate for you
automatically. Back up the `data/` folder periodically — that's the entire database.

### Option B — Render (managed hosting, no server to maintain)

1. Push this project to a GitHub repo (private is fine).
2. In the Render dashboard: **New +** → **Blueprint**, and point it at that repo. Render reads
   `render.yaml` and sets up the web service automatically, using the included `Dockerfile`.
3. When prompted, set `APP_USERNAME` (Render auto-generates a random `APP_PASSWORD` for you via
   the blueprint — find it in the service's Environment tab after it's created, or set your own).
4. Deploy. Render gives you an `https://your-app.onrender.com` URL with HTTPS already handled.

**Free-tier caveat:** Render's free web services don't include persistent disks, so the SQLite
database resets to the seed data on every redeploy or restart — not something you want for real
invoice records. For actual use, upgrade the service to a paid plan (Starter or above) and add
a **Disk** (Render dashboard → your service → Disks) mounted at `/app/data`; after that, data
survives normally. The free tier is fine for trying the app out or showing it to someone, not
for keeping real records.

### Option C — Railway, Fly.io, or any other Node/Docker host

Same idea as Render: point the host at this repo, let it build from the `Dockerfile`, set
`APP_USERNAME`/`APP_PASSWORD` as environment variables, and attach a persistent volume mounted
at `/app/data` (Railway and Fly.io both support this on their standard plans, not just as an
add-on). Without Docker support, the plain `npm install && npm start` from the Setup section
above works too, as long as the host has Chrome/Chromium installed (set `CHROME_PATH` if it's
somewhere unusual).

### Deployment safety checklist

- [ ] `APP_USERNAME` / `APP_PASSWORD` set to real values (not the ones in `.env.example`)
- [ ] The app is served over HTTPS (automatic on Render/Railway/Fly.io; use Caddy or nginx with
      Let's Encrypt if self-hosting on a bare VPS)
- [ ] `data/` (or the mounted disk/volume) is backed up somewhere on a schedule
- [ ] `.env` is never committed to a public repo (`.gitignore` already excludes it)

## Where things live

```
server/
  app.js              Express app entrypoint
  middleware/auth.js  HTTP Basic Auth gate (see "Logging in" above)
  db/init.js          Schema + seed data (SQLite)
  db/catalog_data.js  The 74 products extracted from the NEXUS catalogue PDF
  routes/             REST API: exporters, products, customers, invoices
  pdf/                HTML→PDF templates + Puppeteer rendering
public/
  index.html, css/, js/   Frontend (plain JS, no build step)
Dockerfile, docker-compose.yml, render.yaml   Deployment (see "Deploying" above)
```

## Known limitations / good next steps

- **Single exporter profile**: the Settings page assumes one exporter (NEXUS). The schema
  supports more than one exporter if you ever need to issue invoices under a second entity,
  but the UI only edits the first.
- **Single shared login**: the built-in auth is one username/password for the whole app, not
  per-user accounts — fine for a small team sharing one login, not a substitute for real
  multi-user accounts with individual permissions if you need that later.
- **No CSV/Excel import** yet for bulk-loading existing customers or past invoices — the app
  currently expects you to add customers/products through the UI or API.
