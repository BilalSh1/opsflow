import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AppController } from './app.controller';
import { AuthModule } from './auth/auth.module';
import { OrganizationsModule } from './organizations/organizations.module';
import { IncidentsModule } from './incidents/incidents.module';
import { ProjectsModule } from './projects/projects.module';
import { TeamsModule } from './teams/teams.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      cache: true,
    }),
    AuthModule,
    OrganizationsModule,
    TeamsModule,
    ProjectsModule,
    IncidentsModule,
  ],
  controllers: [AppController],
  providers: [],
})
export class AppModule {}
