import { IsEmail, IsEnum, MaxLength } from 'class-validator';
import { OrganizationRole } from '../../generated/prisma/client';

export class CreateInvitationDto {
  @IsEmail()
  @MaxLength(255)
  email!: string;

  @IsEnum(OrganizationRole)
  role!: OrganizationRole;
}
