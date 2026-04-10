# syntax=docker/dockerfile:1

FROM oven/bun:1-alpine
WORKDIR /app

ENV NODE_ENV=production

COPY package.json bun.lock ./
RUN bun install --frozen-lockfile --production

COPY src ./src
COPY tsconfig.json ./

EXPOSE 3000
CMD ["bun", "run", "src/server.ts"]
