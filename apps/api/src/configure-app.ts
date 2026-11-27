import { INestApplication, ValidationPipe } from '@nestjs/common';
import cookieParser from 'cookie-parser';

// Shared by main.ts and the e2e tests, so tests run the same pipeline.
export function configureApp(app: INestApplication): void {
  app.setGlobalPrefix('api/v1');

  app.use(cookieParser());

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );
}
