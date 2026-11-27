import {
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  UseGuards,
} from '@nestjs/common';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { AccessTokenGuard } from '../auth/guards/access-token.guard';
import type { AccessTokenPayload } from '../auth/interfaces/access-token-payload.interface';
import type {
  AcceptedInvitationResponse,
  InvitationPreviewResponse,
} from './interfaces/invitation-response.interface';
import { InvitationsService } from './invitations.service';

// Routes for the person who received an invitation link. The token in the
// path is the secret from that link.
@Controller('invitations')
export class InvitationsController {
  constructor(private readonly invitationsService: InvitationsService) {}

  @Get(':token')
  preview(@Param('token') token: string): Promise<InvitationPreviewResponse> {
    return this.invitationsService.preview(token);
  }

  @Post(':token/accept')
  @HttpCode(HttpStatus.OK)
  @UseGuards(AccessTokenGuard)
  async accept(
    @Param('token') token: string,
    @CurrentUser() currentUser: AccessTokenPayload,
  ): Promise<AcceptedInvitationResponse> {
    const organization = await this.invitationsService.accept(
      token,
      currentUser.sub,
    );

    return { organization };
  }

  @Post(':token/decline')
  @HttpCode(HttpStatus.NO_CONTENT)
  async decline(@Param('token') token: string): Promise<void> {
    await this.invitationsService.decline(token);
  }
}
