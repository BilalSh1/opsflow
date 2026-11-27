import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { configureApp } from './configure-app';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule);
  const configService = app.get(ConfigService);

  const port = Number(configService.get<string>('PORT') ?? 3000);
  const webOrigin =
    configService.get<string>('WEB_ORIGIN') ?? 'http://localhost:5173';

  configureApp(app);

  app.enableCors({
    origin: webOrigin,
    credentials: true,
  });

  await app.listen(port);

  console.log(`OpsFlow API running at http://localhost:${port}/api/v1`);
}

void bootstrap();
