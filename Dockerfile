# Multi-stage build for LogScope
# Stage 1: Build
FROM node:18-alpine AS builder

WORKDIR /app

# Copy package files
COPY package.json package-lock.json ./
COPY server/package.json server/package.json
COPY web/package.json web/package.json

# Install dependencies
RUN npm ci

# Copy source code
COPY server server
COPY web web

# Build web frontend
RUN npm --workspace=@logscope/web run build

# Build backend
RUN npm --workspace=@logscope/server run build

# Stage 2: Runtime
FROM node:18-alpine

WORKDIR /app

# Install only production dependencies
COPY package.json package-lock.json ./
COPY server/package.json server/package.json

RUN npm ci --omit=dev

# Copy compiled code from builder
COPY --from=builder /app/server/dist server/dist
COPY --from=builder /app/web/dist web/dist
COPY server.js server.js

# Create logs directory
RUN mkdir -p logs

# Expose port (default 3000)
EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
  CMD node -e "require('http').get('http://localhost:3000/health', (r) => {if (r.statusCode !== 200) throw new Error(r.statusCode)})"

# Start application
CMD ["node", "server.js"]
