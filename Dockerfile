# ── build: Vite client + esbuild server ─────────────────────────────────────
FROM node:24-bookworm-slim AS build
# openssl: lets `prisma generate` detect the right engine (debian-openssl-3.0.x)
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
