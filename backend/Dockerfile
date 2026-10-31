# Production Dockerfile for AI Resume Checker Backend
FROM node:20-alpine AS base

WORKDIR /app

# Install dependencies first (layer caching)
COPY package*.json ./
RUN npm ci --omit=dev

# Copy application source code
COPY src/ ./src/

# Create logs directory
RUN mkdir -p logs && chown -R node:node /app

USER node

EXPOSE 5000

ENV NODE_ENV=production \
    PORT=5000

CMD ["node", "src/server.js"]
