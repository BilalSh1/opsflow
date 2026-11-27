import 'dotenv/config';

// The e2e tests wipe their database, so they never use DATABASE_URL itself:
// they use TEST_DATABASE_URL, or the same server with "_test" appended to
// the database name.
export function testDatabaseUrl(): string {
  const explicit = process.env.TEST_DATABASE_URL;
  const base = process.env.DATABASE_URL;

  if (!explicit && !base) {
    throw new Error('Set DATABASE_URL or TEST_DATABASE_URL to run e2e tests');
  }

  const url = new URL(explicit ?? base!);

  if (!explicit) {
    url.pathname = `${url.pathname}_test`;
  }

  if (!databaseName(url.toString()).endsWith('_test')) {
    throw new Error('The e2e test database name must end with "_test"');
  }

  return url.toString();
}

export function databaseName(databaseUrl: string): string {
  return decodeURIComponent(new URL(databaseUrl).pathname.slice(1));
}
