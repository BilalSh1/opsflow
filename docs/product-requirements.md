# OpsFlow — Product Requirements

## 1. Product Overview

OpsFlow is a multi-tenant B2B SaaS platform for managing operational incidents.

It provides organizations with a centralized workspace where teams can report problems, assign responsibility, collaborate during investigations, and track incidents until they are resolved.

The project is designed around common workflows used by engineering, support, IT, and operations teams.

---

## 2. Problem Statement

Operational issues are often managed across multiple tools such as chat applications, email, spreadsheets, and general-purpose task managers.

This makes it difficult for teams to clearly track:

* active incidents
* incident priority and status
* responsibility and ownership
* investigation progress
* communication between team members
* previous changes and actions

OpsFlow provides a single system for managing the complete incident lifecycle.

---

## 3. Target Users

### Organization Owner / Administrator

Responsible for managing the organization's workspace.

Can:

* manage members and roles
* create teams
* create projects
* manage incidents
* configure organization settings

### Team Member

A user who actively works on incidents.

Can:

* report incidents
* update incident information
* assign incidents
* change status and priority
* add comments
* resolve incidents

### Viewer

A read-only organization member.

Can view:

* incidents
* comments
* teams
* projects
* dashboard information

---

## 4. Core Entities

### User

A person with an OpsFlow account.

A user may belong to multiple organizations.

### Organization

Represents a company or workspace using OpsFlow.

Each organization's data must remain isolated from other organizations.

### Organization Member

Represents the relationship between a user and an organization.

Each membership has a role:

* OWNER
* ADMIN
* MEMBER
* VIEWER

### Team

A group of organization members, such as Engineering, Support, or Operations.

### Project

Represents a product, service, or operational area.

Examples:

* Payments Platform
* Mobile Application
* Infrastructure

### Incident

Represents an operational problem that requires investigation.

An incident contains information such as:

* title
* description
* status
* priority
* reporter
* assignee
* assigned team
* project
* creation date
* resolution date

### Comment

A message added to an incident by an organization member.

### Incident Activity

A record of important changes made during the incident lifecycle.

---

## 5. Incident Lifecycle

Supported statuses:

```text
OPEN
INVESTIGATING
BLOCKED
RESOLVED
CLOSED
```

Typical workflow:

```text
OPEN
  ↓
INVESTIGATING
  ↓
RESOLVED
  ↓
CLOSED
```

An incident may temporarily become `BLOCKED` while waiting for another action or dependency.

---

## 6. Incident Priority

Supported priorities:

```text
LOW
MEDIUM
HIGH
CRITICAL
```

Priority represents the urgency and impact of the incident.

Priority and status are independent.

For example:

```text
Priority: CRITICAL
Status: INVESTIGATING
```

means that a severe incident is currently being investigated.

---

## 7. Core Requirements

### Authentication

Users must be able to:

* register
* log in
* log out
* access protected pages

### Organizations

Users must be able to:

* create organizations
* belong to multiple organizations
* switch between organizations

### Membership and Permissions

Organization administrators must be able to:

* invite members
* view members
* assign roles
* remove members

The system must enforce role-based permissions.

### Teams

Administrators must be able to:

* create teams
* manage team members

### Projects

Administrators must be able to:

* create projects
* update projects
* view project incidents

### Incidents

Authorized members must be able to:

* create incidents
* view incidents
* update incidents
* assign incidents
* change status
* change priority
* resolve incidents
* close incidents

### Comments

Members must be able to:

* add comments
* view comments
* edit their own comments
* delete their own comments

### Activity History

Important incident changes must be recorded.

Examples include:

* incident created
* status changed
* priority changed
* assignment changed
* comment added
* incident resolved

### Incident List

Users must be able to browse incidents using:

* pagination
* filtering
* sorting
* search

### Dashboard

The organization dashboard should initially show:

* open incidents
* critical incidents
* recently created incidents
* recently updated incidents

---

## 8. Multi-Tenant Requirement

OpsFlow must keep organization data isolated.

A user belonging to one organization must not be able to access resources belonging to another organization unless they are also an authorized member of that organization.

This restriction must be enforced by the backend.

---

## 9. Main User Flow

A typical workflow is:

1. A user registers and logs in.
2. The user creates an organization.
3. The creator becomes the organization owner.
4. The owner invites other users.
5. Members are assigned roles and teams.
6. The organization creates a project.
7. A member reports an incident.
8. The incident receives a priority and status.
9. The incident is assigned to a team or member.
10. Members investigate and communicate through comments.
11. The incident status changes as work progresses.
12. Important changes are stored in the activity history.
13. The incident is resolved.
14. The incident is eventually closed.

---

## 10. Initial Success Criteria

The initial version of OpsFlow is successful when a user can:

1. Register and log in.
2. Create an organization.
3. Invite another member.
4. Assign organization roles.
5. Create teams.
6. Create projects.
7. Create an incident.
8. Assign the incident.
9. Change its priority and status.
10. Add comments.
11. Resolve and close the incident.
12. View the incident activity history.
13. Browse incidents using pagination and filtering.
14. View a basic organization dashboard.
15. Access only resources belonging to organizations they are authorized to use.
