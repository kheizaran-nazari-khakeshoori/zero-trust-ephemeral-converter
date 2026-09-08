FROM node:22-slim

# Install sharp runtime deps (if building from source) and curl for healthcheck
RUN apt-get update && apt-get install -y --no-install-recommends curl && \
    rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy dependency manifests first for layer caching
COPY server/package*.json ./server/
RUN npm ci --prefix server --omit=dev && npm cache clean --force

# Copy server source (node_modules already installed)
COPY server/ ./server/

# Create non-root user and set ownership
RUN useradd -m -u 1001 appuser && chown -R appuser:appuser /app
USER appuser

ENV NODE_ENV=production
ENV HOST=0.0.0.0
ENV PORT=5000

EXPOSE 5000

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD curl -fsS http://127.0.0.1:5000/api/health || exit 1

CMD ["node", "server/server.js"]
