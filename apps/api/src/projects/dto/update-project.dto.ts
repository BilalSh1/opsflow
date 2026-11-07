import {
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  ValidateIf,
} from 'class-validator';

export class UpdateProjectDto {
  @IsOptional()
  @IsString()
  @Matches(/\S/, { message: 'name must not be empty' })
  @MaxLength(100)
  name?: string;

  // `null` clears the description; leaving it out keeps it.
  @ValidateIf((_dto, value) => value !== null)
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  description?: string | null;
}
