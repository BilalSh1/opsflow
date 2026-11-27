import { execSync } from 'child_process';
import { Client } from 'pg';
import { databaseName, testDatabaseUrl } from './test-database';

// Creates the test database if needed and applies every migration once
// before the e2e suites run.
export default async function globalSetup(): Promise<void> {
  const url = testDatabaseUrl();
  const name = databaseName(url);

  const maintenanceUrl = new URL(url);
  maintenanceUrl.pathname = '/postgres';

  const client = new Client({ connectionString: maintenanceUrl.toString() });
  await client.connect();

  try {
    const existing = await client.query(
      'SELECT 1 FROM pg_database WHERE datname = $1',
      [name],
    );

    if (existing.rowCount === 0) {
      await client.query(`CREATE DATABASE "${name.replace(/"/g, '""')}"`);
    }
  } finally {
    await client.end();
  }

  execSync('npx prisma migrate deploy', {
    env: { ...process.env, DATABASE_URL: url },
    stdio: 'ignore',
  });
}
