FROM node:22-slim

WORKDIR /app/server
COPY server/package*.json ./
RUN npm ci --omit=dev
COPY server/ ./

ENV NODE_ENV=production
ENV HOST=0.0.0.0
EXPOSE 5000

CMD ["node", "server.js"]
