import {
  IsEnum,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  MaxLength,
  ValidateIf,
} from 'class-validator';
import {
  IncidentPriority,
  IncidentStatus,
} from '../../generated/prisma/client';

// Every field is optional. For the nullable ones, `null` clears the value
// and leaving the field out keeps it.
export class UpdateIncidentDto {
  @IsOptional()
  @IsString()
  @Matches(/\S/, { message: 'title must not be empty' })
  @MaxLength(200)
  title?: string;

  @ValidateIf((_dto, value) => value !== null)
  @IsOptional()
  @IsString()
  @MaxLength(10000)
  description?: string | null;

  @IsOptional()
  @IsEnum(IncidentStatus)
  status?: IncidentStatus;

  @IsOptional()
  @IsEnum(IncidentPriority)
  priority?: IncidentPriority;

  @ValidateIf((_dto, value) => value !== null)
  @IsOptional()
  @IsUUID()
  projectId?: string | null;

  @ValidateIf((_dto, value) => value !== null)
  @IsOptional()
  @IsUUID()
  assigneeId?: string | null;

  @ValidateIf((_dto, value) => value !== null)
  @IsOptional()
  @IsUUID()
  assignedTeamId?: string | null;
}
