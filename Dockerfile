# Dockerfile for Render Docker service
FROM node:24-bullseye-slim AS build

WORKDIR /app

RUN corepack enable && corepack prepare pnpm@latest --activate

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml .npmrc ./
COPY lib ./lib
COPY artifacts ./artifacts
COPY scripts ./scripts
COPY tsconfig.json tsconfig.base.json ./

RUN pnpm install --frozen-lockfile
RUN pnpm --filter @workspace/admin-panel run build
RUN pnpm --filter @workspace/api-server run build

FROM node:24-bullseye-slim AS runtime
WORKDIR /app

RUN corepack enable && corepack prepare pnpm@latest --activate

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml .npmrc ./
COPY artifacts/api-server/package.json ./artifacts/api-server/
COPY lib/db/package.json ./lib/db/
COPY lib/api-zod/package.json ./lib/api-zod/

RUN pnpm install --prod --frozen-lockfile --filter @workspace/api-server --filter @workspace/db --filter @workspace/api-zod

COPY --from=build /app/artifacts/api-server/dist ./artifacts/api-server/dist

EXPOSE 5000
ENV PORT=5000
CMD ["pnpm", "--filter", "@workspace/api-server", "run", "start"]