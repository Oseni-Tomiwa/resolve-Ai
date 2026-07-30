# Environment variables

The complete safe variable contract is in the root `.env.example`. Copy it to `.env` for development and inject an equivalent secret-managed file in production. `packages/config` validates the API and worker environment at startup. It never logs secret values; diagnostics only report whether sensitive values are configured.

`DATABASE_URL` and `REDIS_URL` point to local Docker services during development. `JWT_ACCESS_SECRET` and `JWT_REFRESH_SECRET` must be distinct, long random values outside development. `WEB_URL`, `CORS_ALLOWED_ORIGINS`, and the public API/widget URLs control browser connectivity. Production requires HTTPS public URLs and secure HTTP-only cookies.
