import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { OrganizationsModule } from '../organizations/organizations.module';
import { PrismaModule } from '../prisma/prisma.module';
import { DashboardController } from './dashboard.controller';
import { DashboardService } from './dashboard.service';
import { IncidentCommentsService } from './incident-comments.service';
import { IncidentsController } from './incidents.controller';
import { IncidentsService } from './incidents.service';

@Module({
  imports: [PrismaModule, AuthModule, OrganizationsModule],
  controllers: [IncidentsController, DashboardController],
  providers: [IncidentsService, IncidentCommentsService, DashboardService],
})
export class IncidentsModule {}
