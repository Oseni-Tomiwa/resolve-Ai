# Production launch checklist

This is an operator checklist, not a deployment command. It assumes secrets are stored in the hosting provider and that the release is reviewed by the service owner. No live provider calls are made by repository CI.

## Service topology

Run four application services from the repository: `web` (Next.js), `api` (NestJS), `worker` (BullMQ consumer), and a one-shot `migration` release job. PostgreSQL with pgvector and Redis are private dependencies. The API and web are public behind TLS; the worker, database, and Redis are private.

The API exposes `GET /api/v1/health` for liveness and `GET /api/v1/health/ready` for PostgreSQL/Redis readiness. The worker exposes `/health` and `/ready`. A readiness failure must stop traffic rather than be treated as a successful rollout.

## Required production configuration

Inject the following through the platform secret/config store; do not commit them or pass them to the web build unless explicitly prefixed `NEXT_PUBLIC_` and non-secret:

- Runtime: `NODE_ENV=production`, `DATABASE_URL`, `REDIS_URL`, strong distinct `JWT_ACCESS_SECRET` and `JWT_REFRESH_SECRET`, cookie settings, ports, and exact HTTPS `WEB_URL`, `API_URL`, `PUBLIC_API_URL`, `NEXT_PUBLIC_API_URL`, `WIDGET_SCRIPT_URL`, and `CORS_ALLOWED_ORIGINS`.
- AI: `OPENAI_API_KEY`, `OPENAI_GENERATION_MODEL`, `OPENAI_EMBEDDING_MODEL`, `AI_MAX_OUTPUT_TOKENS`, `AI_RETRIEVAL_LIMIT`, `AI_MINIMUM_SCORE`, `EMBEDDING_BATCH_SIZE`.
- Storage: `STORAGE_PROVIDER=s3`, `S3_REGION`, `S3_BUCKET`, access credentials, and optional private endpoint. Production startup rejects local storage.
- Billing: `BILLING_PROVIDER=stripe`, Stripe secret/webhook keys, Pro/Business price IDs, and HTTPS success/cancel/portal URLs. Production startup rejects mock billing.
- Email: `EMAIL_PROVIDER` (`smtp` or `resend`), provider credentials, sender, and reply-to. Console/test providers are rejected in production.
- Webhooks/operations: `WEBHOOK_ENCRYPTION_KEY`, delivery limits, logging level, optional `SENTRY_DSN`, `RELEASE`, and trusted-proxy configuration.

`/Users/mavery/Documents/Codex-workspace/resolveai/.env.example` is the complete safe development reference. It contains no real secrets.

## Release sequence

1. Review the image tag, migration diff, dependency audit, backup/restore result, and change owner.
2. Build with `pnpm install --frozen-lockfile`, Prisma `generate`, `validate`, typecheck, lint, tests, and production build.
3. Build API, worker, and web images from their Dockerfiles. Images exclude environment files, build caches, source maps, and development dependencies from runtime stages, and application containers run as non-root.
4. Run Prisma `migrate:status` against the release database. Take and verify a PostgreSQL/pgvector backup.
5. Run the migration image once as the release job. Never run `db push` or `migrate dev` in production, and never let each API replica migrate on startup.
6. Roll out the worker and API, wait for readiness, then roll out web with the public `NEXT_PUBLIC_API_URL` baked into the build.
7. Run the read-only smoke checks: `WEB_URL=... PUBLIC_API_URL=... WIDGET_SCRIPT_URL=... WORKER_URL=... pnpm smoke:production`.
8. Verify authentication, dashboard tenant selection, knowledge processing, grounded answers, widget config, inbox, analytics, and Stripe test/live mode according to the environment checklist.

## Rollback and recovery

Application images can be rolled back only when the previous image is compatible with the already-applied schema. Migrations are forward-only unless a tested compensating migration exists. Do not delete volumes during rollback. Restore PostgreSQL from a verified backup only under the incident owner’s approval; Redis is rebuildable queue/cache state. Document the restore point, affected workspace scope, request IDs, and customer communication.

## Provider readiness

- Stripe: use separate test/live keys and price IDs, register the signed webhook endpoint, verify idempotency and subscription sync, and test checkout, portal, renewal, cancellation, failed payment, and webhook replay.
- Email: configure a verified sender domain, SPF, DKIM, DMARC, reply-to, bounce handling, and the production base URL; test verification, invitation, password reset, and billing notifications.
- Object storage: use a private encrypted bucket with versioning, lifecycle policy, restricted service credentials, size/content-type validation, and a documented region.
- OpenAI: validate the key and model allowlists privately. CI uses deterministic test providers and does not claim real AI verification.

## Incident checklist

Capture the deployment release, request ID, UTC timestamp, route, status, dependency readiness, and safe error category. Never copy cookies, authorization headers, JWTs, API keys, passwords, prompts, document contents, or full provider responses into tickets. Check API/worker logs, Redis queue depth/failures, database readiness, object-storage errors, provider dashboards, and webhook delivery history.
