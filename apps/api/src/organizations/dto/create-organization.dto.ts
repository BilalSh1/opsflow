import { IsString, Matches, MaxLength } from 'class-validator';

export class CreateOrganizationDto {
  @IsString()
  @Matches(/\S/, { message: 'name must not be empty' })
  @MaxLength(100)
  name!: string;
}
