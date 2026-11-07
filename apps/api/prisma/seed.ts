// Seeds a demo organization with members, teams, projects and incidents.
//
//   npm run db:seed
//
// Safe to rerun: it removes and recreates only the demo organization
// (slug "acme-demo") and the demo accounts below. Timestamps are relative
// to now, so the dashboard always looks current.
import 'dotenv/config';
import { PrismaPg } from '@prisma/adapter-pg';
import * as argon2 from 'argon2';
import {
  IncidentActivityType,
  IncidentPriority,
  IncidentStatus,
  OrganizationRole,
  PrismaClient,
} from '../src/generated/prisma/client';

const DEMO_SLUG = 'acme-demo';
const DEMO_PASSWORD = process.env.SEED_DEMO_PASSWORD ?? 'OpsFlowDemo123!';

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
});

const { OWNER, ADMIN, MEMBER, VIEWER } = OrganizationRole;
const { OPEN, INVESTIGATING, BLOCKED, RESOLVED, CLOSED } = IncidentStatus;
const { LOW, MEDIUM, HIGH, CRITICAL } = IncidentPriority;

const PEOPLE = {
  zakaria: {
    email: 'demo-owner@example.com',
    firstName: 'Zakaria',
    lastName: 'Haddad',
    role: OWNER,
  },
  alice: {
    email: 'demo-admin@example.com',
    firstName: 'Alice',
    lastName: 'Martin',
    role: ADMIN,
  },
  bob: {
    email: 'demo-member@example.com',
    firstName: 'Bob',
    lastName: 'Chen',
    role: MEMBER,
  },
  sara: {
    email: 'demo-support@example.com',
    firstName: 'Sara',
    lastName: 'Lopez',
    role: MEMBER,
  },
  victor: {
    email: 'demo-viewer@example.com',
    firstName: 'Victor',
    lastName: 'Diaz',
    role: VIEWER,
  },
} as const;

type Person = keyof typeof PEOPLE;

const TEAMS: Record<string, Person[]> = {
  Engineering: ['alice', 'bob'],
  Infrastructure: ['bob'],
  Support: ['sara'],
};

const PROJECTS: { name: string; description: string; archived?: boolean }[] = [
  {
    name: 'Payments Platform',
    description: 'Card processing, payouts and refunds.',
  },
  { name: 'Mobile App', description: 'iOS and Android customer apps.' },
  {
    name: 'Customer Portal',
    description: 'Self-service billing and account management.',
  },
  {
    name: 'Authentication Service',
    description: 'Login, SSO and password resets.',
  },
  {
    name: 'Legacy Billing',
    description: 'Replaced by the Payments Platform.',
    archived: true,
  },
];

interface DemoIncident {
  title: string;
  description?: string;
  priority: IncidentPriority;
  status: IncidentStatus;
  project?: string;
  team?: string;
  assignee?: Person;
  reporter: Person;
  hoursAgo: number;
  comments?: [Person, string][];
}

// Listed oldest first; numbers follow this order.
const INCIDENTS: DemoIncident[] = [
  {
    title: 'Typo in invoice email template',
    priority: LOW,
    status: CLOSED,
    project: 'Customer Portal',
    team: 'Support',
    assignee: 'sara',
    reporter: 'sara',
    hoursAgo: 14 * 24,
    comments: [['sara', 'Fixed the template and sent a test invoice.']],
  },
  {
    title: 'Database CPU spikes during nightly backups',
    description: 'Primary database hits 95% CPU between 02:00 and 02:30 UTC.',
    priority: HIGH,
    status: CLOSED,
    team: 'Infrastructure',
    assignee: 'bob',
    reporter: 'alice',
    hoursAgo: 12 * 24,
    comments: [
      ['bob', 'Backups now run against the read replica.'],
      ['alice', 'CPU stayed under 40% for three nights. Closing.'],
    ],
  },
  {
    title: 'Push notifications not delivered on iOS',
    priority: MEDIUM,
    status: CLOSED,
    project: 'Mobile App',
    team: 'Engineering',
    assignee: 'bob',
    reporter: 'sara',
    hoursAgo: 9 * 24,
    comments: [
      [
        'bob',
        'The APNs certificate had expired. Renewed and added a reminder.',
      ],
    ],
  },
  {
    title: 'Duplicate charge notifications',
    priority: LOW,
    status: RESOLVED,
    project: 'Payments Platform',
    team: 'Support',
    assignee: 'sara',
    reporter: 'sara',
    hoursAgo: 6 * 24,
  },
  {
    title: 'Status page showing stale data',
    priority: LOW,
    status: OPEN,
    team: 'Infrastructure',
    reporter: 'victor',
    hoursAgo: 5 * 24,
  },
  {
    title: 'SSO login loop for some enterprise users',
    description:
      'Users on two enterprise tenants are redirected back to the login page after signing in.',
    priority: CRITICAL,
    status: RESOLVED,
    project: 'Authentication Service',
    team: 'Engineering',
    assignee: 'alice',
    reporter: 'zakaria',
    hoursAgo: 4 * 24,
    comments: [
      [
        'alice',
        'The identity provider rotated its signing key; we cached the old one.',
      ],
      [
        'alice',
        'Deployed key refresh on 401. Waiting for confirmation from both customers.',
      ],
    ],
  },
  {
    title: 'Customer portal slow to load invoices',
    priority: MEDIUM,
    status: OPEN,
    project: 'Customer Portal',
    team: 'Engineering',
    reporter: 'sara',
    hoursAgo: 3 * 24,
  },
  {
    title: 'Password reset emails delayed',
    description: 'Reset emails arrive 10–20 minutes late.',
    priority: MEDIUM,
    status: INVESTIGATING,
    project: 'Authentication Service',
    team: 'Support',
    assignee: 'sara',
    reporter: 'victor',
    hoursAgo: 2 * 24,
    comments: [
      [
        'sara',
        'Our email provider reports a queue backlog. Following up with them.',
      ],
    ],
  },
  {
    title: 'Checkout timeouts for EU customers',
    description: 'About 4% of EU checkouts time out after 30 seconds.',
    priority: HIGH,
    status: BLOCKED,
    project: 'Payments Platform',
    team: 'Infrastructure',
    assignee: 'bob',
    reporter: 'alice',
    hoursAgo: 26,
    comments: [
      ['bob', 'Latency is coming from the payment provider’s EU region.'],
      [
        'bob',
        'Blocked until the provider confirms their fix. Ticket opened with them.',
      ],
    ],
  },
  {
    title: 'Mobile app crashes on Android 14 launch',
    priority: HIGH,
    status: OPEN,
    project: 'Mobile App',
    team: 'Engineering',
    reporter: 'sara',
    hoursAgo: 12,
  },
  {
    title: 'Payment API returning 500 errors',
    description:
      'Error rate on POST /payments jumped to 12% after the 13:00 deploy.',
    priority: CRITICAL,
    status: INVESTIGATING,
    project: 'Payments Platform',
    team: 'Engineering',
    assignee: 'bob',
    reporter: 'alice',
    hoursAgo: 5,
    comments: [
      ['bob', 'Rolled back the 13:00 deploy. Error rate is dropping.'],
      ['alice', 'Customers on the status page are asking for an ETA.'],
    ],
  },
  {
    title: 'API rate limiter rejecting valid requests',
    priority: HIGH,
    status: INVESTIGATING,
    project: 'Authentication Service',
    team: 'Engineering',
    assignee: 'alice',
    reporter: 'zakaria',
    hoursAgo: 2,
  },
];

// Statuses an incident passes through to reach `status`, after OPEN.
function pathTo(status: IncidentStatus): IncidentStatus[] {
  switch (status) {
    case OPEN:
      return [];
    case INVESTIGATING:
      return [INVESTIGATING];
    case BLOCKED:
      return [INVESTIGATING, BLOCKED];
    case RESOLVED:
      return [INVESTIGATING, RESOLVED];
    case CLOSED:
      return [INVESTIGATING, RESOLVED, CLOSED];
  }
}

const fullName = (person: Person) =>
  `${PEOPLE[person].firstName} ${PEOPLE[person].lastName}`;

async function main(): Promise<void> {
  const emails = Object.values(PEOPLE).map((person) => person.email);

  // Organization first: its cascade removes members, teams, projects and
  // incidents before the users go.
  await prisma.organization.deleteMany({ where: { slug: DEMO_SLUG } });
  await prisma.user.deleteMany({ where: { email: { in: emails } } });

  const passwordHash = await argon2.hash(DEMO_PASSWORD);
  const now = Date.now();
  const hoursAgo = (hours: number) => new Date(now - hours * 60 * 60 * 1000);

  const organization = await prisma.organization.create({
    data: {
      name: 'Acme Technologies',
      slug: DEMO_SLUG,
      incidentCounter: INCIDENTS.length,
      createdAt: hoursAgo(30 * 24),
    },
  });

  const users = {} as Record<Person, { userId: string; memberId: string }>;

  for (const [key, person] of Object.entries(PEOPLE) as [
    Person,
    (typeof PEOPLE)[Person],
  ][]) {
    const user = await prisma.user.create({
      data: {
        email: person.email,
        passwordHash,
        firstName: person.firstName,
        lastName: person.lastName,
        memberships: {
          create: { organizationId: organization.id, role: person.role },
        },
      },
      include: { memberships: true },
    });

    users[key] = { userId: user.id, memberId: user.memberships[0].id };
  }

  const teams: Record<string, string> = {};

  for (const [name, members] of Object.entries(TEAMS)) {
    const team = await prisma.team.create({
      data: {
        organizationId: organization.id,
        name,
        members: {
          create: members.map((person) => ({
            organizationMemberId: users[person].memberId,
          })),
        },
      },
    });

    teams[name] = team.id;
  }

  const projects: Record<string, string> = {};

  for (const project of PROJECTS) {
    const created = await prisma.project.create({
      data: {
        organizationId: organization.id,
        name: project.name,
        description: project.description,
        archivedAt: project.archived ? hoursAgo(20 * 24) : null,
      },
    });

    projects[project.name] = created.id;
  }

  for (const [index, incident] of INCIDENTS.entries()) {
    const steps = pathTo(incident.status);
    const comments = incident.comments ?? [];
    // Spread the history over the incident's age, at most 6 hours apart.
    const gap = Math.min(
      incident.hoursAgo / (steps.length + comments.length + 2),
      6,
    );
    let at = incident.hoursAgo;
    const next = () => hoursAgo((at -= gap));

    const createdAt = hoursAgo(at);
    const activities: {
      type: IncidentActivityType;
      actorId: string;
      oldValue?: string;
      newValue?: string;
      createdAt: Date;
    }[] = [
      {
        type: IncidentActivityType.CREATED,
        actorId: users[incident.reporter].userId,
        createdAt,
      },
    ];
    const worker = incident.assignee ?? incident.reporter;

    if (incident.assignee) {
      activities.push({
        type: IncidentActivityType.ASSIGNEE_CHANGED,
        actorId: users[incident.reporter].userId,
        newValue: fullName(incident.assignee),
        createdAt: next(),
      });
    }

    let previous: IncidentStatus = OPEN;
    let resolvedAt: Date | null = null;
    let closedAt: Date | null = null;
    const commentRows: {
      authorId: string;
      content: string;
      createdAt: Date;
      updatedAt: Date;
    }[] = [];

    const addComments = () => {
      for (const [author, content] of comments) {
        const commentedAt = next();
        commentRows.push({
          authorId: users[author].userId,
          content,
          createdAt: commentedAt,
          updatedAt: commentedAt,
        });
        activities.push({
          type: IncidentActivityType.COMMENT_ADDED,
          actorId: users[author].userId,
          createdAt: commentedAt,
        });
      }
    };

    // Comments come once work has started, or straight away for incidents
    // that are still open.
    if (steps.length === 0) {
      addComments();
    }

    steps.forEach((status, stepIndex) => {
      const changedAt = next();
      activities.push({
        type: IncidentActivityType.STATUS_CHANGED,
        actorId: users[status === CLOSED ? incident.reporter : worker].userId,
        oldValue: previous,
        newValue: status,
        createdAt: changedAt,
      });
      resolvedAt = status === RESOLVED ? changedAt : resolvedAt;
      closedAt = status === CLOSED ? changedAt : closedAt;
      previous = status;

      if (stepIndex === 0) {
        addComments();
      }
    });

    const updatedAt = activities.at(-1)!.createdAt;

    await prisma.incident.create({
      data: {
        organizationId: organization.id,
        number: index + 1,
        title: incident.title,
        description: incident.description ?? null,
        status: incident.status,
        priority: incident.priority,
        projectId: incident.project ? projects[incident.project] : null,
        assignedTeamId: incident.team ? teams[incident.team] : null,
        assigneeId: incident.assignee
          ? users[incident.assignee].memberId
          : null,
        reporterId: users[incident.reporter].userId,
        createdAt,
        updatedAt,
        resolvedAt,
        closedAt,
        comments: { create: commentRows },
        activities: { create: activities },
      },
    });
  }

  console.log(
    `Seeded "${organization.name}" with ${INCIDENTS.length} incidents.`,
  );
  console.log(
    'Demo accounts (password: SEED_DEMO_PASSWORD or the default in prisma/seed.ts):',
  );

  for (const person of Object.values(PEOPLE)) {
    console.log(`  ${person.role.padEnd(6)}  ${person.email}`);
  }
}

main()
  .catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
