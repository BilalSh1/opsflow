# OpsFlow API

NestJS + Prisma + PostgreSQL backend for OpsFlow. Setup, architecture and demo accounts are described in the [main README](../../README.md).

```bash
cp .env.example .env
npm ci
npm run prisma:generate
npx prisma migrate deploy
npm run db:seed      # optional demo data
npm run start:dev    # http://localhost:3000/api/v1
```

| Command | What it does |
| --- | --- |
| `npm run start:dev` | Start with file watching |
| `npm test` | Unit tests (Jest) |
| `npm run test:e2e` | End-to-end tests (needs the database) |
| `npm run lint:check` | ESLint without fixing (`npm run lint` fixes) |
| `npm run typecheck` | TypeScript, including tests |
| `npm run build` / `npm run start:prod` | Production build and start |
| `npm run db:migrate` | Create and apply a migration after a schema change |
| `npm run db:seed` | Reset and load the demo organization |
| `npm run db:studio` | Browse the database |

All routes are under `/api/v1`. Organization data lives under `/organizations/:organizationId/...` and is protected by `AccessTokenGuard`, `OrganizationMemberGuard` and `PermissionGuard`, in that order.
