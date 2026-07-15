# ============================================================
# Northeast Watch API — production Dockerfile
# Multi-stage build: compile with full devDependencies, ship
# only the production runtime + compiled output.
# ============================================================

FROM node:20-alpine AS builder
WORKDIR /app

COPY package.json package-lock.json* ./
RUN npm ci

COPY tsconfig.json ./
COPY src ./src
RUN npx prisma generate --schema src/db/prisma/schema.prisma
RUN npm run build


FROM node:20-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production

# Run as a non-root user — never run the app as root in a container.
RUN addgroup -g 1001 nodejs && adduser -S nodeapp -u 1001

COPY package.json package-lock.json* ./
RUN npm ci --omit=dev && npm cache clean --force

COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma
COPY src/db/prisma ./src/db/prisma

USER nodeapp
EXPOSE 4000

# tini handles PID 1 signal forwarding correctly (SIGTERM reaches the app
# for graceful shutdown, and zombie processes from any subprocess get reaped).
RUN apk add --no-cache tini
ENTRYPOINT ["/sbin/tini", "--"]

HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
  CMD node -e "fetch('http://localhost:4000/health/live').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

CMD ["node", "dist/server.js"]
