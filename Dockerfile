# ── build: Vite client + esbuild server ─────────────────────────────────────
FROM node:24-bookworm-slim AS build
# openssl: lets `prisma generate` detect the right engine (debian-openssl-3.0.x)
# Acquire::ForceIPv4 — deb.debian.org now answers this resolver with an IPv6-only address
# and the NAS has no IPv6 route to the internet, so apt opens a connection that can never
# complete and sits in select() forever: no error, no load, no output. Diagnosed and the fix
# proven by Admin, 21 Sep 2026 (53s with the line, hangs indefinitely without it). Needed in
# BOTH stages — the build stage fetches packages too, and will hang the same way the moment
# its layer cache is invalidated.
RUN printf 'Acquire::ForceIPv4 "true";\n' > /etc/apt/apt.conf.d/99force-ipv4
RUN apt-get update && apt-get install -y --no-install-recommends openssl ca-certificates && rm -rf /var/lib/apt/lists/*
WORKDIR /app
COPY package*.json ./
COPY prisma ./prisma
RUN npm ci
COPY . .
RUN npm run build

# ── runtime ─────────────────────────────────────────────────────────────────
FROM node:24-bookworm-slim
# chromium: report PDFs · python3 libs: invoice OCR (fitz), QR codes, Excel budget parsing
# Same as the build stage above: force IPv4, or apt hangs. deb.debian.org now answers this resolver with an IPv6-only address
# answers this resolver with an IPv6-only address and the NAS has no IPv6 route out.
RUN printf 'Acquire::ForceIPv4 "true";\n' > /etc/apt/apt.conf.d/99force-ipv4
RUN apt-get update && apt-get install -y --no-install-recommends \
      chromium fonts-dejavu fonts-noto-core fonts-noto-color-emoji openssl \
      python3 python3-fitz python3-qrcode python3-openpyxl \
    && rm -rf /var/lib/apt/lists/*
WORKDIR /app
ENV NODE_ENV=production \
    PORT=3100 \
    CHROME_PATH=/usr/bin/chromium \
    CHROME_NO_SANDBOX=1 \
    DATABASE_URL=file:/data/db/dev.db \
    ANAHON_VAULT=/data/vault
COPY --from=build --chown=node:node /app/package*.json ./
COPY --from=build --chown=node:node /app/node_modules ./node_modules
COPY --from=build --chown=node:node /app/prisma ./prisma
COPY --from=build --chown=node:node /app/dist ./dist
COPY --chmod=755 docker/entrypoint.sh /entrypoint.sh
RUN mkdir -p /data/db /data/vault && chown -R node:node /data
USER node
EXPOSE 3100
VOLUME ["/data/db", "/data/vault"]
ENTRYPOINT ["/entrypoint.sh"]
