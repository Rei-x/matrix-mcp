# syntax=docker/dockerfile:1

FROM oven/bun:1-alpine
WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3000

COPY package.json bun.lock ./
RUN bun install --frozen-lockfile --production

COPY src ./src
COPY tsconfig.json ./

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=3s --start-period=10s --retries=3 \
  CMD-SHELL wget -qO- "http://127.0.0.1:${PORT:-3000}/health" > /dev/null || exit 1

CMD ["bun", "run", "src/server.ts"]
