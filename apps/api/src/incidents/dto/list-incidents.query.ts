import { Transform, Type } from 'class-transformer';
import {
  IsEnum,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import {
  IncidentPriority,
  IncidentStatus,
} from '../../generated/prisma/client';

const UUID = '[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}';
// A uuid, or "none" for "not set".
const ID_OR_NONE = new RegExp(`^(none|${UUID})$`, 'i');
// Assignee filter also accepts "me".
const ASSIGNEE_FILTER = new RegExp(`^(none|me|${UUID})$`, 'i');

// "OPEN,BLOCKED" -> ["OPEN", "BLOCKED"]
const commaList = ({ value }: { value: unknown }) =>
  typeof value === 'string'
    ? value
        .split(',')
        .map((item) => item.trim())
        .filter(Boolean)
    : value;

export const INCIDENT_SORT_FIELDS = [
  'updatedAt',
  'createdAt',
  'priority',
  'number',
] as const;

export type IncidentSortField = (typeof INCIDENT_SORT_FIELDS)[number];

export class ListIncidentsQuery {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  pageSize?: number;

  @IsOptional()
  @Transform(commaList)
  @IsEnum(IncidentStatus, { each: true })
  status?: IncidentStatus[];

  @IsOptional()
  @Transform(commaList)
  @IsEnum(IncidentPriority, { each: true })
  priority?: IncidentPriority[];

  @IsOptional()
  @Matches(ID_OR_NONE, { message: 'projectId must be a UUID or "none"' })
  projectId?: string;

  @IsOptional()
  @Matches(ID_OR_NONE, { message: 'assignedTeamId must be a UUID or "none"' })
  assignedTeamId?: string;

  @IsOptional()
  @Matches(ASSIGNEE_FILTER, {
    message: 'assigneeId must be a UUID, "me" or "none"',
  })
  assigneeId?: string;

  // Matches the title, or the number as "12" or "INC-12".
  @IsOptional()
  @IsString()
  @MaxLength(200)
  search?: string;

  @IsOptional()
  @IsIn(INCIDENT_SORT_FIELDS)
  sort?: IncidentSortField;

  @IsOptional()
  @IsIn(['asc', 'desc'])
  order?: 'asc' | 'desc';
}
