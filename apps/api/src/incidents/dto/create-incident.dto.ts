import {
  IsEnum,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  MaxLength,
} from 'class-validator';
import { IncidentPriority } from '../../generated/prisma/client';

export class CreateIncidentDto {
  @IsString()
  @Matches(/\S/, { message: 'title must not be empty' })
  @MaxLength(200)
  title!: string;

  @IsOptional()
  @IsString()
  @MaxLength(10000)
  description?: string;

  @IsOptional()
  @IsEnum(IncidentPriority)
  priority?: IncidentPriority;

  @IsOptional()
  @IsUUID()
  projectId?: string;

  // The organization membership id from the members list.
  @IsOptional()
  @IsUUID()
  assigneeId?: string;

  @IsOptional()
  @IsUUID()
  assignedTeamId?: string;
}
