import { IsString, Matches, MaxLength } from 'class-validator';

// Used for both creating and renaming a team.
export class TeamNameDto {
  @IsString()
  @Matches(/\S/, { message: 'name must not be empty' })
  @MaxLength(100)
  name!: string;
}
