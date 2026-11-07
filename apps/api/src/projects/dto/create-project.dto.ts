import { IsOptional, IsString, Matches, MaxLength } from 'class-validator';

export class CreateProjectDto {
  @IsString()
  @Matches(/\S/, { message: 'name must not be empty' })
  @MaxLength(100)
  name!: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  description?: string;
}
