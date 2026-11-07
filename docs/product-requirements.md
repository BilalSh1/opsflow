# OpsFlow Product Requirements

## 1. Product Overview

OpsFlow is a multi-tenant B2B SaaS platform that helps organizations report, assign, track, and resolve operational incidents.

The platform is designed for teams such as engineering, customer support, IT, and operations that need a centralized place to manage incidents and collaborate during their resolution.

Organizations can create workspaces, invite members, organize users into teams, create projects, report incidents, assign responsibility, communicate through comments, and track the full history of each incident.

OpsFlow will initially focus on core incident-management functionality and will later expand with features such as real-time updates, notifications, SLA tracking, automation rules, webhooks, analytics, and external integrations.

---

## 2. Problem Statement

Organizations often manage operational problems using several disconnected tools such as email, messaging applications, spreadsheets, and general-purpose task-management platforms.

This can make incident handling difficult because teams may not have a clear view of:

* what incidents are currently active
* which incidents are most urgent
* who is responsible for resolving each incident
* what actions have already been taken
* which team owns the problem
* how long incidents take to resolve
* whether important incidents are being handled on time
* what changes were made during the incident lifecycle

This fragmented process can lead to poor communication, duplicated work, slower response times, and a lack of accountability.

OpsFlow provides a centralized system where organizations can manage incidents throughout their entire lifecycle.

---

## 3. Target Users

### 3.1 Organization Owner

The organization owner creates the workspace and has full control over the organization.

The owner can:

* manage organization settings
* invite and remove members
* assign roles
* create and manage teams
* create and manage projects
* manage incidents
* configure organization-level settings
* access administrative information

---

### 3.2 Organization Administrator

Administrators help manage the organization and its members.

Administrators can:

* invite members
* manage member roles
* create and manage teams
* create and manage projects
* manage incidents
* access administrative features allowed by their role

Administrators cannot perform actions that are restricted to the organization owner.

---

### 3.3 Team Member

Team members are users who actively work on incidents.

Members can:

* view incidents
* create incidents
* update incidents
* assign incidents when permitted
* change incident status
* change incident priority
* add comments
* collaborate with other members
* resolve incidents

---

### 3.4 Viewer

Viewers have read-only access to organization information.

Viewers can:

* view incidents
* view incident comments
* view incident activity
* view projects
* view teams
* view dashboard information

Viewers cannot modify organization resources.

---

## 4. Main User Workflow

A typical OpsFlow workflow is:

1. A user registers for an OpsFlow account.
2. The user creates an organization.
3. The creator becomes the organization owner.
4. The owner invites other users to join the organization.
5. Members are assigned roles.
6. The organization creates teams such as Engineering, Support, or Operations.
7. Members can be assigned to one or more teams.
8. The organization creates projects representing products, services, or systems.
9. A member discovers an operational problem.
10. The member creates an incident.
11. The incident receives a priority and initial status.
12. The incident is assigned to a member or team.
13. Team members investigate the issue.
14. Members communicate through incident comments.
15. The incident status changes as work progresses.
16. Important changes are recorded in the incident activity history.
17. Once the issue is fixed, the incident is marked as resolved.
18. After verification, the incident can be closed.

Example:

```text
Zakaria creates "Acme Technologies"
        |
        v
Invites Alice and Bob
        |
        v
Creates Engineering Team
        |
        v
Creates Payments Project
        |
        v
Alice detects payment API failures
        |
        v
Creates INC-001
"Payment API returning 500 errors"
Priority: CRITICAL
Status: OPEN
        |
        v
Assigns Engineering Team
        |
        v
Bob starts investigating
OPEN -> INVESTIGATING
        |
        v
Bob adds investigation notes
        |
        v
Issue is fixed
        |
        v
INVESTIGATING -> RESOLVED
        |
        v
Incident is verified and CLOSED
```

---

## 5. Incident Definition

An incident represents an operational problem that requires investigation and resolution.

Examples include:

* an API returning errors
* a production service becoming unavailable
* payment failures
* database performance problems
* customer-facing application errors
* infrastructure failures
* unexpected system behavior

Each incident contains information describing the problem and its current state.

### Incident Fields

An incident should contain:

* unique identifier
* organization-specific incident number
* title
* description
* status
* priority
* organization
* project
* reporter
* assignee
* assigned team
* creation date
* last update date
* resolution date
* closing date

---

## 6. Incident Status

The incident status represents the current stage of the incident lifecycle.

### OPEN

The incident has been reported but investigation has not yet started.

### INVESTIGATING

A member or team is actively investigating the problem.

### BLOCKED

Work cannot currently continue because the incident depends on another action, person, system, or external factor.

### RESOLVED

The problem has been fixed, but the incident may still require verification before being permanently closed.

### CLOSED

The incident has been resolved and no further work is required.

Typical lifecycle:

```text
OPEN
  |
  v
INVESTIGATING
  |
  +------> BLOCKED
  |           |
  |           v
  +<----------+
  |
  v
RESOLVED
  |
  v
CLOSED
```

---

## 7. Incident Priority

Priority represents the urgency and importance of an incident.

### LOW

Minor issue with little or no impact on users or business operations.

### MEDIUM

A noticeable issue that should be addressed but does not significantly affect critical functionality.

### HIGH

A serious issue affecting important functionality or multiple users.

### CRITICAL

A severe incident that significantly affects business operations, system availability, security, or a large number of users.

Status and priority are independent.

For example:

```text
Priority: CRITICAL
Status: INVESTIGATING
```

means that the incident is highly urgent and is currently being investigated.

---

## 8. Core Entities

### 8.1 User

A User represents a person who has an OpsFlow account.

A user may belong to multiple organizations.

Example:

```text
Zakaria
|
+-- Acme Technologies
|   Role: OWNER
|
+-- Example Startup
    Role: MEMBER
```

---

### 8.2 Organization

An Organization represents a company or workspace using OpsFlow.

Organization data must be isolated from all other organizations.

Each organization contains its own:

* members
* teams
* projects
* incidents
* comments
* settings
* activity

---

### 8.3 Organization Member

An Organization Member represents the relationship between a user and an organization.

It stores information specific to that membership, such as the user's role.

Possible roles:

* OWNER
* ADMIN
* MEMBER
* VIEWER

A user may have different roles in different organizations.

---

### 8.4 Team

A Team represents a group of organization members working together.

Examples:

* Engineering
* Backend
* Infrastructure
* Customer Support
* Operations

A member may belong to multiple teams.

---

### 8.5 Project

A Project represents a product, service, application, or operational area where incidents may occur.

Examples:

* Payments Platform
* Mobile Application
* Authentication Service
* Customer Portal
* Infrastructure

Projects belong to an organization.

---

### 8.6 Incident

An Incident represents an operational problem that needs to be investigated and resolved.

Incidents belong to an organization and may also belong to a project.

An incident may be assigned to:

* an individual member
* a team
* both a member and a team

---

### 8.7 Comment

A Comment represents a message added to an incident by an organization member.

Comments allow members to:

* share investigation results
* provide updates
* communicate with other members
* document important information

---

### 8.8 Incident Activity

Incident Activity records important events that occur during the lifecycle of an incident.

Examples:

* incident created
* priority changed
* status changed
* assignee changed
* team changed
* comment added
* incident resolved
* incident closed

Example:

```text
13:21 Zakaria created the incident

13:24 Alice changed priority
HIGH -> CRITICAL

13:27 Bob was assigned

13:31 Bob changed status
OPEN -> INVESTIGATING

13:45 Bob added a comment

14:12 Bob changed status
INVESTIGATING -> RESOLVED
```

---

## 9. Core Product Features

### 9.1 Authentication

Users should be able to:

* register
* log in
* log out
* remain authenticated between sessions
* refresh authentication when necessary
* reset forgotten passwords
* access protected resources only when authenticated

Passwords must never be stored in plain text.

---

### 9.2 Organizations

Users should be able to:

* create organizations
* view organizations they belong to
* switch between organizations

The organization creator automatically becomes the organization owner.

---

### 9.3 Organization Membership

Organization owners and administrators should be able to:

* invite members
* view members
* assign roles
* change roles
* remove members

Users may belong to multiple organizations.

---

## 10. Roles and Permissions

OpsFlow should implement role-based access control.

Initial roles:

```text
OWNER
ADMIN
MEMBER
VIEWER
```

Permissions depend on the user's role inside the organization.

Example permissions:

| Action               | Owner | Admin | Member | Viewer |
| -------------------- | ----- | ----- | ------ | ------ |
| View incidents       | Yes   | Yes   | Yes    | Yes    |
| Create incidents     | Yes   | Yes   | Yes    | No     |
| Update incidents     | Yes   | Yes   | Yes    | No     |
| Comment on incidents | Yes   | Yes   | Yes    | No     |
| Create projects      | Yes   | Yes   | No     | No     |
| Manage teams         | Yes   | Yes   | No     | No     |
| Invite members       | Yes   | Yes   | No     | No     |
| Change member roles  | Yes   | Yes   | No     | No     |
| Delete organization  | Yes   | No    | No     | No     |

The permission system should be designed so that additional permissions can be added later.

---

## 11. Teams

Organizations should be able to create teams.

Organization owners and administrators should be able to:

* create teams
* rename teams
* remove teams
* add members to teams
* remove members from teams

Members may belong to multiple teams.

---

## 12. Projects

Organizations should be able to create projects.

Each project contains:

* name
* description
* organization
* creation date

Projects may contain multiple incidents.

Organization owners and administrators should be able to:

* create projects
* update projects
* archive or remove projects

---

## 13. Incident Management

Authorized organization members should be able to:

* create incidents
* view incidents
* update incidents
* assign incidents
* change incident status
* change incident priority
* resolve incidents
* close incidents

Incident access must always be restricted to users belonging to the same organization.

---

## 14. Incident Listing

Users should be able to view organization incidents in a paginated list.

The system should not load every incident at once.

The incident list should eventually support:

* pagination
* filtering
* sorting
* searching

Possible filters include:

* status
* priority
* project
* assigned team
* assignee
* creation date

---

## 15. Comments

Authorized members should be able to communicate inside incidents using comments.

Members should be able to:

* create comments
* view comments
* edit their own comments
* delete their own comments

Comment creation should be recorded in the incident activity history.

---

## 16. Activity History

Important incident changes should be recorded automatically.

The activity history should contain:

* action type
* user responsible for the action
* date and time
* previous value when relevant
* new value when relevant

Examples:

```text
Alice changed priority from HIGH to CRITICAL.

Bob changed status from OPEN to INVESTIGATING.

Zakaria assigned the incident to Backend Team.
```

---

## 17. Dashboard

Users should have access to an organization dashboard.

The first version should display basic information such as:

* number of open incidents
* number of critical incidents
* recently created incidents
* recently updated incidents

More advanced analytics will be added later.

---

## 18. Future Features

The following features are outside the initial MVP but are planned for later development.

### Real-Time Updates

Incident changes should appear in connected clients without requiring a page refresh.

---

### Notifications

Users should receive notifications when important events occur.

Examples:

* incident assigned to user
* incident assigned to user's team
* incident priority becomes critical
* someone comments on an assigned incident
* SLA deadline is approaching

---

### Redis Caching

Frequently accessed or expensive data may be cached using Redis to improve performance.

---

### Background Jobs

Long-running or asynchronous work should be handled outside the normal HTTP request lifecycle.

Examples:

* sending notifications
* sending emails
* processing webhooks
* checking SLA deadlines

---

### SLA Policies

Organizations should be able to define expected response and resolution times based on incident priority.

Example:

```text
CRITICAL
Response: 10 minutes
Resolution: 1 hour

HIGH
Response: 30 minutes
Resolution: 4 hours

MEDIUM
Response: 4 hours
Resolution: 24 hours
```

OpsFlow should detect when an incident violates these limits.

---

### Automation Rules

Organizations should be able to automate incident actions.

Rules should follow the model:

```text
WHEN
an event occurs

IF
conditions match

THEN
perform actions
```

Example:

```text
WHEN
Incident created

IF
Priority = CRITICAL

THEN
Assign Engineering Team
Send notification
```

---

### File Attachments

Users should be able to attach files to incidents.

Possible files include:

* screenshots
* logs
* documents
* reports

Files should be stored outside the main relational database.

---

### Public REST API

Organizations should eventually be able to integrate external systems with OpsFlow.

Possible functionality:

* create incidents
* retrieve incidents
* update incidents
* retrieve projects

---

### API Keys

Organizations should be able to generate API keys for external integrations.

API keys should support configurable permissions or scopes.

---

### Webhooks

Organizations should be able to register webhook endpoints.

OpsFlow should send events such as:

```text
incident.created
incident.updated
incident.resolved
incident.closed
```

Webhook delivery should eventually support:

* payload signing
* retry handling
* delivery history

---

### Advanced Analytics

Future dashboard metrics may include:

* incidents by priority
* incidents by project
* incidents over time
* average response time
* average resolution time
* SLA compliance percentage
* incidents assigned per team

---

### Audit Logs

Administrative and security-related actions should be recorded.

Examples:

* member invited
* member removed
* role changed
* API key created
* project deleted
* organization settings changed

---

### Email Notifications

Users should eventually be able to receive important notifications by email.

---

## 19. Non-Functional Requirements

### 19.1 Security

The application must protect user and organization data.

The system should:

* securely hash passwords
* validate user input
* authenticate protected requests
* enforce authorization rules
* protect sensitive configuration and secrets
* prevent unauthorized organization access

---

### 19.2 Multi-Tenant Data Isolation

Data belonging to one organization must never be accessible by users from another organization unless explicitly permitted.

For example:

```text
User from Organization A
```

must never be able to access:

```text
Incident belonging to Organization B
```

even if the user knows or guesses the incident identifier.

Tenant isolation must be enforced by the backend rather than relying only on frontend restrictions.

---

### 19.3 Reliability

Important operations should fail safely.

The system should avoid:

* partially completed important operations
* corrupted relationships
* duplicate processing where possible
* inconsistent application state

Database transactions should be used when multiple related operations must succeed or fail together.

---

### 19.4 Maintainability

The application should use clear separation of responsibilities.

Backend architecture should separate:

```text
Controllers
     |
     v
Services / Business Logic
     |
     v
Database Access
```

Code should be organized into clear modules based on application domains.

---

### 19.5 Performance

The application should avoid unnecessarily loading large amounts of data.

The system should use:

* server-side pagination
* server-side filtering
* appropriate database indexes
* efficient database queries

Performance optimizations should be based on actual system requirements rather than premature optimization.

---

### 19.6 Scalability

The system should be designed so that expensive or asynchronous tasks can later be moved to background workers.

Examples include:

* notifications
* email delivery
* webhook delivery
* SLA checks
* automation processing

The architecture should allow the API and workers to scale independently in later versions.

---

### 19.7 Observability

The system should eventually provide useful logs for debugging and monitoring.

Logs should contain useful contextual information without exposing sensitive data.

Examples include:

* request identifier
* user identifier
* organization identifier
* endpoint
* HTTP status
* processing duration

---

### 19.8 Testability

Core business logic should be designed in a way that can be tested independently.

The project should eventually include:

* unit tests
* integration tests
* API end-to-end tests
* frontend tests
* critical browser workflow tests

---

## 20. Initial Success Criteria

The first functional version of OpsFlow will be considered successful when the following workflow works correctly:

1. A user can register.
2. A user can log in.
3. An authenticated user can create an organization.
4. The organization creator becomes the owner.
5. The owner can invite another user.
6. The invited user can join the organization.
7. The owner can assign organization roles.
8. The organization can create a team.
9. Members can be assigned to a team.
10. The organization can create a project.
11. An authorized member can create an incident.
12. The incident can be assigned to a member or team.
13. The incident priority can be changed.
14. The incident status can be changed.
15. Members can add comments.
16. Important changes appear in the incident activity history.
17. The incident can be resolved.
18. The incident can be closed.
19. Users can view incidents belonging to their organization.
20. Users cannot access resources belonging to organizations they are not authorized to access.

---

## 21. Product Scope Principles

During development, the following principles should guide decisions.

### Build the Core Product First

Advanced infrastructure should not be added before the core product works.

The initial focus is:

```text
Authentication
Organizations
Membership
Roles and Permissions
Teams
Projects
Incidents
Comments
Activity History
Basic Dashboard
```

---

### Prefer Incremental Development

OpsFlow should be developed in small working steps.

Each major feature should:

1. solve a specific product requirement
2. be implemented independently where possible
3. include appropriate validation
4. include appropriate testing
5. be committed separately to Git

---

### Backend Security Is Authoritative

Frontend restrictions improve user experience but must never be considered a security boundary.

All permissions and tenant isolation must be validated by the backend.

---

### Technologies Should Solve Problems

Technologies such as Redis, BullMQ, WebSockets, Docker, and AWS should only be introduced when the project reaches a feature that benefits from them.

The goal of the project is not simply to include technologies, but to understand why each technology is useful and how it solves a real software-engineering problem.