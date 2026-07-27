# OpsFlow Architecture

## Overview

OpsFlow uses a simple three-layer architecture for the MVP:

```text
React + TypeScript
        |
        | REST / JSON
        v
NestJS + TypeScript
        |
        | Prisma
        v
PostgreSQL
```

---

## Frontend

The React frontend is responsible for:

* UI and navigation
* forms and user interaction
* loading and error states
* communicating with the backend API

The frontend may hide unavailable actions, but security and permissions are always enforced by the backend.

---

## Backend

NestJS is responsible for:

* authentication
* authorization
* input validation
* business logic
* tenant isolation
* database access through Prisma

Typical request flow:

```text
Request
   ↓
Controller
   ↓
Service
   ↓
Prisma
   ↓
PostgreSQL
```

Controllers handle HTTP requests, while services contain the main business logic.

---

## Multi-Tenancy

Each organization must only access its own data.

For organization-owned resources, the backend must verify:

```text
Authenticated user
        ↓
Organization membership
        ↓
Required permission
        ↓
Organization-owned resource
```

Tenant isolation must always be enforced on the backend.

---

## Backend Structure

```text
src/
├── auth/
├── users/
├── organizations/
├── teams/
├── projects/
├── incidents/
├── comments/
└── prisma/
```

The backend is organized by business domain.

---

## Frontend Structure

```text
src/
├── components/
├── pages/
├── features/
├── api/
├── hooks/
├── types/
└── router/
```

---

## API

The frontend communicates with the backend using REST endpoints under:

```text
/api/v1
```

Example:

```text
POST /api/v1/auth/login

GET  /api/v1/organizations

GET  /api/v1/organizations/:organizationId/incidents

POST /api/v1/organizations/:organizationId/incidents
```

---

## MVP Boundaries

The initial architecture only uses:

```text
React
NestJS
PostgreSQL
Prisma
```

Technologies such as Redis, BullMQ, WebSockets, Docker, and AWS will be added later when the project reaches features that require them.
