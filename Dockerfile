# syntax=docker/dockerfile:1

FROM oven/bun:1-alpine
WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3000

COPY package.json bun.lock ./
RUN bun install --frozen-lockfile --production

COPY public ./public
COPY src ./src
COPY tsconfig.json ./

EXPOSE 3000

# Shell-form CMD (not CMD-SHELL) for compatibility with older builders.
HEALTHCHECK --interval=30s --timeout=3s --start-period=10s --retries=3 \
  CMD wget -q -O /dev/null http://127.0.0.1:3000/health || exit 1

CMD ["bun", "run", "src/server.ts"]
