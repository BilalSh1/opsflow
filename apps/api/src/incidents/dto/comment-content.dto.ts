import { IsString, Matches, MaxLength } from 'class-validator';

// Used for both adding and editing a comment.
export class CommentContentDto {
  @IsString()
  @Matches(/\S/, { message: 'content must not be empty' })
  @MaxLength(5000)
  content!: string;
}
