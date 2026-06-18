FROM node:20-alpine

WORKDIR /app

# Install dependencies
COPY package.json package-lock.json ./
RUN npm ci --production=false

# Build TypeScript
COPY tsconfig.json ./
COPY src/ ./src/
RUN npm run build

# Remove dev dependencies
RUN npm prune --production

# Create data directory
RUN mkdir -p /app/data

# Run as non-root
RUN addgroup -g 1001 aegis && adduser -u 1001 -G aegis -s /bin/sh -D aegis
RUN chown -R aegis:aegis /app
USER aegis

# Health check — agent logs to stdout every 30s
HEALTHCHECK --interval=60s --timeout=10s --retries=3 \
  CMD test $(find /tmp/aegis-heartbeat -mmin -2 2>/dev/null | wc -l) -gt 0 || exit 1

CMD ["node", "dist/index.js"]
