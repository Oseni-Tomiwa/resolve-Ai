# Railway service setup

Railway is the primary deployment target. Configure four Railway services from this monorepo; keep PostgreSQL/Redis private or use managed private services. Do not commit Railway tokens or environment values.

| Service   | Dockerfile                                | Port/health                          | Required runtime                                                     |
| --------- | ----------------------------------------- | ------------------------------------ | -------------------------------------------------------------------- |
| web       | `apps/web/Dockerfile`                     | `$PORT`, `/`                         | `NEXT_PUBLIC_API_URL` as a non-secret build argument; public web URL |
| api       | `apps/api/Dockerfile` target `runtime`    | `$PORT`/4000, `/api/v1/health/ready` | database, Redis, JWT, AI, storage, billing, email, webhook config    |
| worker    | `apps/worker/Dockerfile` target `runtime` | `$PORT`/4100, `/ready`               | database, Redis, AI, storage config                                  |
| migration | `apps/api/Dockerfile` target `migration`  | one-shot release                     | database URL and Prisma migration files                              |

Set the service root to the repository root and use the listed Dockerfile path. Set `PORT` to the platform-provided value where supported; the web image honors `$PORT`, while API and worker use their validated service ports and should be mapped by the platform. Attach the migration service to the same private database network and run it once per release before API traffic.

Configure a custom domain and TLS at Railway, then set exact HTTPS values for `WEB_URL`, `API_URL`, `PUBLIC_API_URL`, `NEXT_PUBLIC_API_URL`, `WIDGET_SCRIPT_URL`, and `CORS_ALLOWED_ORIGINS`. Do not use localhost in production.

Use Railway health checks for liveness/readiness, restart policies for API/worker, persistent managed PostgreSQL storage, private Redis, bounded logs, and a documented backup provider. Railway configuration is intentionally manual here so the repository does not contain environment-specific identifiers or secrets.
