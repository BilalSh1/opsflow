import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { PrismaModule } from '../prisma/prisma.module';
import { OrganizationMemberGuard } from './guards/organization-member.guard';
import { OrganizationMembersService } from './organization-members.service';
import { OrganizationsController } from './organizations.controller';
import { OrganizationsService } from './organizations.service';

@Module({
  imports: [PrismaModule, AuthModule],
  controllers: [OrganizationsController],
  providers: [
    OrganizationsService,
    OrganizationMembersService,
    OrganizationMemberGuard,
  ],
  exports: [OrganizationMembersService, OrganizationMemberGuard],
})
export class OrganizationsModule {}
