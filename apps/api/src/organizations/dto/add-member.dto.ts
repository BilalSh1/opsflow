import { IsEmail, IsEnum, MaxLength } from 'class-validator';
import { OrganizationRole } from '../../generated/prisma/client';

export class AddMemberDto {
  @IsEmail()
  @MaxLength(255)
  email!: string;

  @IsEnum(OrganizationRole)
  role!: OrganizationRole;
}
