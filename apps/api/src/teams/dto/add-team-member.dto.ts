import { IsUUID } from 'class-validator';

export class AddTeamMemberDto {
  // The organization membership id from the members list.
  @IsUUID()
  memberId!: string;
}
