import { INestApplication } from '@nestjs/common';
import { App } from 'supertest/types';
import type {
  LoginResponse,
  MeResponse,
  RegisterResponse,
} from '../src/auth/interfaces/auth-response.interface';
import {
  api,
  bearer,
  createTestApp,
  login,
  PASSWORD,
  refreshCookieFrom,
  resetDatabase,
} from './utils';

describe('Authentication (e2e)', () => {
  let app: INestApplication<App>;

  beforeAll(async () => {
    app = await createTestApp();
    await resetDatabase(app);
  });

  afterAll(async () => {
    await app.close();
  });

  describe('POST /auth/register', () => {
    it('creates an account and never returns the password hash', async () => {
      const response = await api(app)
        .post('/api/v1/auth/register')
        .send({
          email: 'Dana@Example.com',
          password: PASSWORD,
          firstName: 'Dana',
          lastName: 'Levi',
        })
        .expect(201);

      const body = response.body as RegisterResponse;

      expect(body.user).toMatchObject({
        email: 'dana@example.com',
        firstName: 'Dana',
        lastName: 'Levi',
      });
      expect(JSON.stringify(body)).not.toMatch(/password/i);
    });

    it('rejects a second account with the same email', async () => {
      await api(app)
        .post('/api/v1/auth/register')
        .send({
          email: 'dana@example.com',
          password: PASSWORD,
          firstName: 'Other',
          lastName: 'Person',
        })
        .expect(409);
    });

    it('validates the request body', async () => {
      await api(app)
        .post('/api/v1/auth/register')
        .send({ email: 'not-an-email', password: 'short' })
        .expect(400);
    });
  });

  describe('POST /auth/login', () => {
    it('returns an access token and sets an httpOnly refresh cookie', async () => {
      const response = await api(app)
        .post('/api/v1/auth/login')
        .send({ email: 'dana@example.com', password: PASSWORD })
        .expect(200);

      const body = response.body as LoginResponse;
      const setCookie = (response.headers['set-cookie'] as unknown as string[])
        .join(';')
        .toLowerCase();

      expect(body.accessToken).toEqual(expect.any(String));
      expect(body.user.email).toBe('dana@example.com');
      expect(setCookie).toContain('httponly');
      expect(setCookie).toContain('samesite=strict');
    });

    it('gives the same answer for a wrong password and an unknown email', async () => {
      const wrongPassword = await api(app)
        .post('/api/v1/auth/login')
        .send({ email: 'dana@example.com', password: 'wrong-password' })
        .expect(401);

      const unknownEmail = await api(app)
        .post('/api/v1/auth/login')
        .send({ email: 'nobody@example.com', password: PASSWORD })
        .expect(401);

      expect(unknownEmail.body).toEqual(wrongPassword.body);
    });
  });

  describe('GET /auth/me', () => {
    it('returns the user for a valid access token', async () => {
      const dana = await login(app, 'dana@example.com');

      const response = await api(app)
        .get('/api/v1/auth/me')
        .set(bearer(dana.accessToken))
        .expect(200);

      expect((response.body as MeResponse).user.id).toBe(dana.user.id);
    });

    it('rejects a missing or invalid token', async () => {
      await api(app).get('/api/v1/auth/me').expect(401);
      await api(app)
        .get('/api/v1/auth/me')
        .set(bearer('not-a-jwt'))
        .expect(401);
    });
  });

  describe('refresh and logout', () => {
    it('rotates the refresh token on every refresh', async () => {
      const dana = await login(app, 'dana@example.com');

      const response = await api(app)
        .post('/api/v1/auth/refresh')
        .set('Cookie', dana.refreshCookie)
        .expect(200);

      const rotatedCookie = refreshCookieFrom(response);

      expect(rotatedCookie).not.toBe(dana.refreshCookie);
      expect((response.body as LoginResponse).accessToken).toEqual(
        expect.any(String),
      );

      await api(app)
        .post('/api/v1/auth/refresh')
        .set('Cookie', rotatedCookie)
        .expect(200);
    });

    it('ends every session when a used refresh token comes back', async () => {
      const laptop = await login(app, 'dana@example.com');
      const phone = await login(app, 'dana@example.com');

      const rotated = await api(app)
        .post('/api/v1/auth/refresh')
        .set('Cookie', laptop.refreshCookie)
        .expect(200);

      // Replaying the old token looks like theft.
      await api(app)
        .post('/api/v1/auth/refresh')
        .set('Cookie', laptop.refreshCookie)
        .expect(401);

      // Both the rotated token and the other device are now logged out.
      await api(app)
        .post('/api/v1/auth/refresh')
        .set('Cookie', refreshCookieFrom(rotated))
        .expect(401);
      await api(app)
        .post('/api/v1/auth/refresh')
        .set('Cookie', phone.refreshCookie)
        .expect(401);
    });

    it('logout revokes only the current session', async () => {
      const laptop = await login(app, 'dana@example.com');
      const phone = await login(app, 'dana@example.com');

      await api(app)
        .post('/api/v1/auth/logout')
        .set('Cookie', laptop.refreshCookie)
        .expect(204);

      // Checked first: replaying the laptop token below counts as reuse
      // and would end the phone session too.
      await api(app)
        .post('/api/v1/auth/refresh')
        .set('Cookie', phone.refreshCookie)
        .expect(200);
      await api(app)
        .post('/api/v1/auth/refresh')
        .set('Cookie', laptop.refreshCookie)
        .expect(401);
    });

    it('rejects a refresh without a cookie', async () => {
      await api(app).post('/api/v1/auth/refresh').expect(401);
    });
  });
});
