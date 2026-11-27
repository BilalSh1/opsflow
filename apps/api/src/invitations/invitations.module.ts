import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { OrganizationsModule } from '../organizations/organizations.module';
import { PrismaModule } from '../prisma/prisma.module';
import { InvitationsController } from './invitations.controller';
import { InvitationsService } from './invitations.service';
import { OrganizationInvitationsController } from './organization-invitations.controller';

@Module({
  imports: [PrismaModule, AuthModule, OrganizationsModule],
  controllers: [OrganizationInvitationsController, InvitationsController],
  providers: [InvitationsService],
})
export class InvitationsModule {}
