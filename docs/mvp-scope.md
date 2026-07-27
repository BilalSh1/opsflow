# OpsFlow MVP Scope

## Goal

The MVP should allow an organization to manage the complete basic lifecycle
of an operational incident, from creation to resolution.

## Included Features

### Authentication
- Register
- Login
- Logout
- Protected routes

### Organizations
- Create organization
- View organizations the user belongs to
- Switch between organizations

### Members and Roles
- Invite members
- View members
- Assign roles
- Remove members

Roles:
- OWNER
- ADMIN
- MEMBER
- VIEWER

### Teams
- Create teams
- Add members to teams
- Remove members from teams

### Projects
- Create projects
- Update projects
- View projects

### Incidents
- Create incidents
- View incident list
- View incident details
- Update incidents
- Assign incident to a user or team
- Change priority
- Change status
- Resolve and close incidents

Statuses:
- OPEN
- INVESTIGATING
- BLOCKED
- RESOLVED
- CLOSED

Priorities:
- LOW
- MEDIUM
- HIGH
- CRITICAL

### Comments
- Add comments
- View comments
- Edit own comments
- Delete own comments

### Activity History
Track important changes such as:
- incident created
- status changed
- priority changed
- assignment changed
- comment added
- incident resolved

### Incident List
- Pagination
- Basic filtering
- Basic sorting

### Dashboard
Show:
- open incidents
- critical incidents
- recently created incidents
- recently updated incidents

## Required Security

- Users must be authenticated to access protected resources.
- Backend must enforce role permissions.
- Users must only access organizations they belong to.
- Resources from one organization must not be accessible from another.

## Out of Scope for MVP

The following features will be implemented after V1:

- WebSockets
- real-time updates
- Redis
- BullMQ
- background jobs
- SLA policies
- automation rules
- file attachments
- AWS deployment
- API keys
- public API
- webhooks
- advanced analytics
- audit logs
- email notifications
- CI/CD

## MVP Completion Criteria

The MVP is complete when:

1. A user can register and log in.
2. A user can create an organization.
3. The owner can invite another member.
4. Roles and permissions work correctly.
5. Teams can be created.
6. Projects can be created.
7. Members can create incidents.
8. Incidents can be assigned.
9. Status and priority can be updated.
10. Members can add comments.
11. Incident activity is recorded.
12. Incidents can be resolved and closed.
13. Incidents can be browsed using pagination and filters.
14. A basic dashboard displays organization incident data.
15. Cross-organization access is prevented.