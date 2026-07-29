import { ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule);
  const configService = app.get(ConfigService);

  const port = Number(configService.get<string>('PORT') ?? 3000);
  const webOrigin =
    configService.get<string>('WEB_ORIGIN') ?? 'http://localhost:5173';

  app.setGlobalPrefix('api/v1');

  app.enableCors({
    origin: webOrigin,
    credentials: true,
  });

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  await app.listen(port);

  console.log(`OpsFlow API running at http://localhost:${port}/api/v1`);
}

void bootstrap();
