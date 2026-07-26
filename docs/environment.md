# Environment variables

Copy `.env.example` to `.env`. `DATABASE_URL` and `REDIS_URL` point to local Docker services. `JWT_ACCESS_SECRET` and `JWT_REFRESH_SECRET` must be long random values in non-development environments. `WEB_URL` controls credentialed CORS and `API_PORT` controls the NestJS listener.
