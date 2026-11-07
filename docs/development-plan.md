# OpsFlow Development Plan

OpsFlow is built in small, focused pull requests. Each one solves one requirement, includes tests, and is merged into `main` before the next starts. Scope is defined in [mvp-scope.md](mvp-scope.md) and [product-requirements.md](product-requirements.md).

## Done (MVP)

| Area | What was built | Pull requests |
| --- | --- | --- |
| Foundation | Product docs, React and NestJS apps, PostgreSQL in Docker, Prisma | #1–#10 |
| Authentication | Register, login, JWT access tokens, current user | #11–#13 |
| Sessions | Refresh tokens rotated on every use with reuse detection, logout | #14–#16 |
| Web authentication | Login and register pages, protected routes, silent refresh | #17 |
| Organizations | Create and list organizations, membership guard, switcher | #18–#19 |
| Roles and members | Permission table, add members, change roles, remove and leave | #20–#21 |
| Teams | Create, rename and delete teams; manage team members | #22–#23 |
| Projects | Create, edit, archive, restore and delete projects | #24–#25 |
| Incidents | Numbered incidents, status workflow, assignment, comments, activity history, filtered and paginated list, dashboard | #26 |

All MVP completion criteria in [mvp-scope.md](mvp-scope.md) are met, with one simplification: members are added by email if they already have an account, instead of through an invitation they accept.

## Next

1. **Invitations**: invite people by email (including people without an account) and let them accept or decline.
2. **Organization settings**: rename an organization; owners can delete it.
3. **End-to-end tests**: API tests against a test database for authentication and cross-organization isolation; browser tests for the main incident flow.
4. **Deployment**: host the API, web app and database, with a seeded demo account.

## Later

These are planned in [product-requirements.md](product-requirements.md) and deliberately left out of the MVP:

- Password reset and email notifications
- Real-time updates (WebSockets) and in-app notifications
- Background jobs (BullMQ, Redis): notifications, cleanup of expired sessions, SLA checks
- SLA policies and automation rules
- File attachments
- API keys, a public API and webhooks
- Advanced analytics and audit logs
