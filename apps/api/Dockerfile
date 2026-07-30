FROM node:22-bookworm-slim AS base
ENV COREPACK_HOME=/corepack PNPM_HOME=/pnpm PATH=/pnpm:$PATH
RUN corepack enable && corepack prepare pnpm@9.15.0 --activate
WORKDIR /app
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml turbo.json ./
COPY apps/api/package.json apps/api/package.json
COPY apps/worker/package.json apps/worker/package.json
COPY apps/widget/package.json apps/widget/package.json
COPY apps/web/package.json apps/web/package.json
COPY packages/ai/package.json packages/ai/package.json
COPY packages/config/package.json packages/config/package.json
COPY packages/database/package.json packages/database/package.json
COPY packages/eslint-config/package.json packages/eslint-config/package.json
COPY packages/shared/package.json packages/shared/package.json
COPY packages/storage/package.json packages/storage/package.json
COPY packages/typescript-config/package.json packages/typescript-config/package.json
COPY packages/ui/package.json packages/ui/package.json
RUN pnpm install --frozen-lockfile
COPY . .

FROM base AS build
RUN pnpm --filter @resolveai/database generate
RUN pnpm --filter @resolveai/api... build
RUN pnpm deploy --filter @resolveai/api --prod /prod/api

FROM base AS migration
ENV NODE_ENV=production
WORKDIR /app
CMD ["pnpm", "--filter", "@resolveai/database", "migrate:deploy"]

FROM node:22-bookworm-slim AS runtime
ENV NODE_ENV=production NODE_OPTIONS=--enable-source-maps
WORKDIR /app
COPY --from=build --chown=node:node /prod/api ./
COPY --from=build --chown=node:node /app/packages/database/prisma ./prisma
USER node
EXPOSE 4000
HEALTHCHECK --interval=15s --timeout=5s --start-period=20s --retries=5 CMD node -e "fetch('http://127.0.0.1:'+(process.env.API_PORT||4000)+'/api/v1/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
CMD ["node", "dist/main.js"]
