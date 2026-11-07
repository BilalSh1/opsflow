import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { PrismaModule } from '../prisma/prisma.module';
import { UsersModule } from '../users/users.module';
import { OrganizationMemberGuard } from './guards/organization-member.guard';
import { MembersController } from './members.controller';
import { MembersService } from './members.service';
import { OrganizationMembersService } from './organization-members.service';
import { OrganizationsController } from './organizations.controller';
import { OrganizationsService } from './organizations.service';
import { PermissionGuard } from './permissions/permission.guard';

@Module({
  imports: [PrismaModule, AuthModule, UsersModule],
  controllers: [OrganizationsController, MembersController],
  providers: [
    OrganizationsService,
    OrganizationMembersService,
    MembersService,
    OrganizationMemberGuard,
    PermissionGuard,
  ],
  exports: [
    OrganizationMembersService,
    OrganizationMemberGuard,
    PermissionGuard,
  ],
})
export class OrganizationsModule {}
