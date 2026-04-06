FROM oven/bun:1.2 AS base
WORKDIR /app

# Install dependencies
FROM base AS deps
COPY package.json bun.lock ./
COPY packages/core/package.json packages/core/
COPY packages/editor/package.json packages/editor/
COPY packages/admin/package.json packages/admin/
COPY packages/server/package.json packages/server/
COPY packages/renderer/package.json packages/renderer/
COPY packages/cli/package.json packages/cli/
RUN bun install --frozen-lockfile

# Build
FROM deps AS build
COPY . .
RUN bun run build

# Production
FROM base AS production
COPY --from=build /app /app

ENV NODE_ENV=production
ENV PORT=4321

# Create data directories
RUN mkdir -p /app/data /app/uploads

VOLUME ["/app/data", "/app/uploads"]

EXPOSE 4321

CMD ["bun", "packages/server/src/dev.ts"]
