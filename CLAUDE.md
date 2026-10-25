# OpsFlow

OpsFlow is a multi-tenant B2B incident-management SaaS.

## Stack

Frontend:
- React
- TypeScript
- Vite

Backend:
- Node.js
- NestJS
- TypeScript
- Prisma
- PostgreSQL

Infrastructure:
- Docker Compose

## Architecture

React -> REST API -> NestJS -> Prisma -> PostgreSQL

## Development Rules

- Work incrementally.
- Do not introduce new technologies unless they solve a real requirement.
- Keep controllers thin.
- Put business logic in services.
- Enforce tenant isolation on the backend.
- Never return password hashes or secrets.
- Use DTO validation for HTTP input.
- Write tests for important business logic.
- Do not modify generated Prisma files manually.
- Do not commit .env files.
- Before making a large change, explain the plan first.

## Git Workflow

For each meaningful feature:

1. Start from updated main.
2. Create a feature branch.
3. Implement one focused change.
4. Run build, lint, and tests.
5. Review the diff.
6. Commit with a conventional commit message.
7. Push and create a PR.

Do not make unrelated changes in the same branch.

## Useful Commands

Backend:
cd apps/api
npm run build
npm run lint
npm test
npm run test:e2e
npm run start:dev

Frontend:
cd apps/web
npm run dev

Database:
docker compose up -d postgres
docker compose ps

## Current Priority

Finish authentication, then move to frontend authentication and the core product:
organizations -> RBAC -> teams -> projects -> incidents.
