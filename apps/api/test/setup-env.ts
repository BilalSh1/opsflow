import { testDatabaseUrl } from './test-database';

// Runs before each suite imports the app. ConfigModule does not override
// variables that are already set, so the app connects to the test database.
process.env.DATABASE_URL = testDatabaseUrl();
process.env.JWT_ACCESS_SECRET ??= 'e2e-test-secret';
