import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from '../src/app.module';
import type {
  AuthUserResponse,
  LoginResponse,
} from '../src/auth/interfaces/auth-response.interface';
import { REFRESH_TOKEN_COOKIE } from '../src/auth/refresh-token';
import { configureApp } from '../src/configure-app';
import type { OrganizationDetailResponse } from '../src/organizations/interfaces/organization-response.interface';
import { PrismaService } from '../src/prisma/prisma.service';
import { databaseName } from './test-database';

export const PASSWORD = 'correct-horse-battery';

export interface TestUser {
  user: AuthUserResponse;
  email: string;
  accessToken: string;
  // "refresh_token=<value>", ready for a Cookie header.
  refreshCookie: string;
}

export async function createTestApp(): Promise<INestApplication<App>> {
  const moduleRef = await Test.createTestingModule({
    imports: [AppModule],
  }).compile();

  const app = moduleRef.createNestApplication<INestApplication<App>>();
  configureApp(app);
  await app.init();

  return app;
}

// Removes every row. Deleting users and organizations cascades to all
// other tables.
export async function resetDatabase(app: INestApplication): Promise<void> {
  const url = process.env.DATABASE_URL ?? '';

  if (!databaseName(url).endsWith('_test')) {
    throw new Error('Refusing to reset a database that is not a test one');
  }

  await app
    .get(PrismaService)
    .$executeRawUnsafe('TRUNCATE TABLE users, organizations CASCADE');
}

export function api(app: INestApplication<App>) {
  return request(app.getHttpServer());
}

export function bearer(accessToken: string): { Authorization: string } {
  return { Authorization: `Bearer ${accessToken}` };
}

export function refreshCookieFrom(response: request.Response): string {
  const header = response.headers['set-cookie'] as unknown;
  const cookies = Array.isArray(header) ? (header as string[]) : [];
  const cookie = cookies.find((value) =>
    value.startsWith(`${REFRESH_TOKEN_COOKIE}=`),
  );

  if (!cookie) {
    throw new Error('Response did not set a refresh token cookie');
  }

  return cookie.split(';')[0];
}

export async function registerUser(
  app: INestApplication<App>,
  firstName: string,
): Promise<TestUser> {
  const email = `${firstName.toLowerCase()}@example.com`;

  await api(app)
    .post('/api/v1/auth/register')
    .send({ email, password: PASSWORD, firstName, lastName: 'Test' })
    .expect(201);

  return login(app, email);
}

export async function login(
  app: INestApplication<App>,
  email: string,
): Promise<TestUser> {
  const response = await api(app)
    .post('/api/v1/auth/login')
    .send({ email, password: PASSWORD })
    .expect(200);

  const body = response.body as LoginResponse;

  return {
    user: body.user,
    email,
    accessToken: body.accessToken,
    refreshCookie: refreshCookieFrom(response),
  };
}

export async function createOrganization(
  app: INestApplication<App>,
  owner: TestUser,
  name: string,
): Promise<string> {
  const response = await api(app)
    .post('/api/v1/organizations')
    .set(bearer(owner.accessToken))
    .send({ name })
    .expect(201);

  return (response.body as OrganizationDetailResponse).organization.id;
}
