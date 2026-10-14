# Multi-stage build: compile TypeScript, then run with minimal Node image
FROM node:20-alpine AS builder

WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY tsconfig.json ./
COPY src/ ./src/
RUN npm run build

FROM node:20-alpine AS runner

RUN addgroup -S appgroup && adduser -S appuser -G appgroup
WORKDIR /app
COPY package*.json ./
RUN npm ci --production
COPY --from=builder /app/dist ./dist
RUN chown -R appuser:appgroup /app

USER appuser
EXPOSE 3001

CMD ["node", "dist/app.js"]
