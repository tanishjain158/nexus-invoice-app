# Runs the NEXUS Export Invoice System: Node/Express API + static frontend + SQLite database,
# with Chromium installed for server-side PDF generation (Puppeteer in "core" mode).
FROM node:22-slim

RUN apt-get update && apt-get install -y --no-install-recommends \
      chromium \
      fonts-liberation \
    && rm -rf /var/lib/apt/lists/*

ENV CHROME_PATH=/usr/bin/chromium
ENV NODE_ENV=production
ENV PORT=4000
# System Chromium is already installed above, so skip full puppeteer's own ~300MB bundled
# download during npm install (it's only needed as a fallback on non-Docker deploys — see
# server/pdf/render.js — where there's no apt-installed Chromium to point CHROME_PATH at).
ENV PUPPETEER_SKIP_DOWNLOAD=true

WORKDIR /app

COPY package*.json ./
RUN npm install --omit=dev

COPY . .

# SQLite database lives here — mount a volume/disk at this path in production so data survives
# restarts and redeploys (see README's Deploying section).
RUN mkdir -p /app/data
VOLUME ["/app/data"]

EXPOSE 4000
CMD ["node", "server/app.js"]
