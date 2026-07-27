# OpsFlow Database Design

## Core Entities

### User

```text
id
email
passwordHash
firstName
lastName
createdAt
updatedAt
```

A user can belong to multiple organizations.

---

### Organization

```text
id
name
slug
createdAt
updatedAt
```

An organization contains members, teams, projects, and incidents.

---

### OrganizationMember

Connects a user to an organization.

```text
id
userId
organizationId
role
createdAt
```

Roles:

```text
OWNER
ADMIN
MEMBER
VIEWER
```

Relationship:

```text
User
  ↓
OrganizationMember
  ↓
Organization
```

This creates a many-to-many relationship between users and organizations.

---

### Team

```text
id
name
organizationId
createdAt
updatedAt
```

Each team belongs to one organization.

---

### TeamMember

Connects organization members to teams.

```text
id
teamId
organizationMemberId
```

A member may belong to multiple teams.

---

### Project

```text
id
name
description
organizationId
createdAt
updatedAt
```

Each project belongs to one organization.

---

### Incident

```text
id
number
title
description
status
priority

organizationId
projectId

reporterId
assigneeId
assignedTeamId

createdAt
updatedAt
resolvedAt
closedAt
```

Status:

```text
OPEN
INVESTIGATING
BLOCKED
RESOLVED
CLOSED
```

Priority:

```text
LOW
MEDIUM
HIGH
CRITICAL
```

---

### Comment

```text
id
content
incidentId
authorId
createdAt
updatedAt
```

Each comment belongs to one incident.

---

### IncidentActivity

```text
id
incidentId
actorId
type
oldValue
newValue
createdAt
```

Used to record important changes such as:

```text
status changed
priority changed
assignee changed
incident resolved
```

---

## Main Relationships

```text
User
 │
 └──< OrganizationMember >── Organization
                                  │
                                  ├──< Team
                                  │     │
                                  │     └──< TeamMember
                                  │
                                  ├──< Project
                                  │
                                  └──< Incident
                                         │
                                         ├──< Comment
                                         │
                                         └──< IncidentActivity
```

## Important Constraints

* `User.email` must be unique.
* `Organization.slug` must be unique.
* A user should only have one membership per organization.
* A member should only belong to a team once.
* All organization-owned resources must reference their organization.
* Incidents must only reference projects, users, and teams belonging to the same organization.
