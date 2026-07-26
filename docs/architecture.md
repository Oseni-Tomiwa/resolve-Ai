# Architecture overview

The web app is a Next.js App Router client. The API is a stateless NestJS REST service with thin controllers and service-owned business rules. Prisma is the single source of database types. PostgreSQL stores tenant data and Redis is reserved for queues and realtime coordination. The worker consumes BullMQ jobs; the widget and AI packages are explicit future-phase seams.

Tenant access follows user → organization membership → workspace membership. Services query membership in the same operation as the resource lookup, so changing an identifier cannot cross tenant boundaries.
