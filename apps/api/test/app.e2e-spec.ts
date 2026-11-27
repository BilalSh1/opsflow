import { INestApplication } from '@nestjs/common';
import { App } from 'supertest/types';
import { api, createTestApp } from './utils';

interface HealthResponse {
  status: string;
  service: string;
  timestamp: string;
}

describe('AppController (e2e)', () => {
  let app: INestApplication<App>;

  beforeAll(async () => {
    app = await createTestApp();
  });

  afterAll(async () => {
    await app.close();
  });

  it('/api/v1/health (GET)', async () => {
    const response = await api(app).get('/api/v1/health').expect(200);

    const body = response.body as HealthResponse;

    expect(body.status).toBe('ok');
    expect(body.service).toBe('opsflow-api');
    expect(body.timestamp).toBeDefined();
  });
});
