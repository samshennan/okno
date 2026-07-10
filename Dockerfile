# Multi-stage build — builder installs native deps for better-sqlite3,
# runtime copies only what is needed.

FROM node:22-alpine AS builder

RUN apk add --no-cache python3 make g++

WORKDIR /build

COPY package.json package-lock.json ./
RUN npm ci --omit=dev

# ---- runtime ----

FROM node:22-alpine

RUN addgroup -S okno && adduser -S okno -G okno

WORKDIR /app

COPY --from=builder /build/node_modules ./node_modules

COPY server.js auth.js oauth-clients.js logger.js photo-cache.js photo-proxy.js \
     picker.js config.js health.js demo-photos.js package.json ./

COPY db/ ./db/
COPY public/ ./public/

RUN mkdir -p data logs && chown -R okno:okno /app

USER okno

EXPOSE 3100

CMD ["node", "server.js"]
