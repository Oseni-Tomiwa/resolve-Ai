# ResolveAI agent rules

- Inspect existing code before introducing abstractions; do not modify unrelated files.
- Keep controllers thin: validate DTOs, call services, and return response envelopes.
- Preserve strict TypeScript and avoid `any` without a documented reason.
- Every tenant resource must be scoped through authenticated membership and role checks; never trust IDs from clients.
- Use Prisma migrations for schema changes. Never edit generated client output by hand.
- Hash passwords with Argon2 and store only hashed refresh tokens.
- Add unit and integration coverage for auth, authorization, and tenant isolation.
- Run lint, format check, typecheck, tests, and build before committing.
- Do not commit secrets, generated credentials, or unrelated changes.
