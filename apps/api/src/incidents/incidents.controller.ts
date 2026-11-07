import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  NotFoundException,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { AccessTokenGuard } from '../auth/guards/access-token.guard';
import { CurrentMembership } from '../organizations/decorators/current-membership.decorator';
import { OrganizationMemberGuard } from '../organizations/guards/organization-member.guard';
import type { MembershipWithOrganization } from '../organizations/interfaces/membership.interface';
import { PermissionGuard } from '../organizations/permissions/permission.guard';
import { RequirePermission } from '../organizations/permissions/require-permission.decorator';
import { CommentContentDto } from './dto/comment-content.dto';
import { CreateIncidentDto } from './dto/create-incident.dto';
import { ListIncidentsQuery } from './dto/list-incidents.query';
import { UpdateIncidentDto } from './dto/update-incident.dto';
import { IncidentCommentsService } from './incident-comments.service';
import { IncidentNumberPipe } from './incident-number.pipe';
import { IncidentsService } from './incidents.service';
import type {
  IncidentActivityResponse,
  IncidentCommentResponse,
  IncidentDetailResponse,
  IncidentListResponse,
} from './interfaces/incident-response.interface';

const commentIdPipe = new ParseUUIDPipe({
  exceptionFactory: () => new NotFoundException('Comment not found'),
});

type IncidentBody = { incident: IncidentDetailResponse };
type CommentBody = { comment: IncidentCommentResponse };

// Incidents are addressed by their per-organization number, e.g.
// /organizations/:organizationId/incidents/12 for INC-12.
@Controller('organizations/:organizationId/incidents')
@UseGuards(AccessTokenGuard, OrganizationMemberGuard, PermissionGuard)
export class IncidentsController {
  constructor(
    private readonly incidentsService: IncidentsService,
    private readonly commentsService: IncidentCommentsService,
  ) {}

  @Get()
  @RequirePermission('incidents:view')
  list(
    @CurrentMembership() membership: MembershipWithOrganization,
    @Query() query: ListIncidentsQuery,
  ): Promise<IncidentListResponse> {
    return this.incidentsService.list(membership, query);
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @RequirePermission('incidents:create')
  async create(
    @CurrentMembership() membership: MembershipWithOrganization,
    @Body() createIncidentDto: CreateIncidentDto,
  ): Promise<IncidentBody> {
    const incident = await this.incidentsService.create(
      membership,
      createIncidentDto,
    );

    return { incident };
  }

  @Get(':number')
  @RequirePermission('incidents:view')
  async get(
    @CurrentMembership() membership: MembershipWithOrganization,
    @Param('number', IncidentNumberPipe) number: number,
  ): Promise<IncidentBody> {
    const incident = await this.incidentsService.get(
      membership.organizationId,
      number,
    );

    return { incident };
  }

  @Patch(':number')
  @RequirePermission('incidents:update')
  async update(
    @CurrentMembership() membership: MembershipWithOrganization,
    @Param('number', IncidentNumberPipe) number: number,
    @Body() updateIncidentDto: UpdateIncidentDto,
  ): Promise<IncidentBody> {
    const incident = await this.incidentsService.update(
      membership,
      number,
      updateIncidentDto,
    );

    return { incident };
  }

  @Get(':number/activity')
  @RequirePermission('incidents:view')
  async activity(
    @CurrentMembership() membership: MembershipWithOrganization,
    @Param('number', IncidentNumberPipe) number: number,
  ): Promise<{ activity: IncidentActivityResponse[] }> {
    const activity = await this.commentsService.listActivity(
      membership.organizationId,
      number,
    );

    return { activity };
  }

  @Get(':number/comments')
  @RequirePermission('incidents:view')
  async comments(
    @CurrentMembership() membership: MembershipWithOrganization,
    @Param('number', IncidentNumberPipe) number: number,
  ): Promise<{ comments: IncidentCommentResponse[] }> {
    const comments = await this.commentsService.listComments(
      membership.organizationId,
      number,
    );

    return { comments };
  }

  @Post(':number/comments')
  @HttpCode(HttpStatus.CREATED)
  @RequirePermission('incidents:comment')
  async addComment(
    @CurrentMembership() membership: MembershipWithOrganization,
    @Param('number', IncidentNumberPipe) number: number,
    @Body() commentContentDto: CommentContentDto,
  ): Promise<CommentBody> {
    const comment = await this.commentsService.addComment(
      membership,
      number,
      commentContentDto.content,
    );

    return { comment };
  }

  @Patch(':number/comments/:commentId')
  @RequirePermission('incidents:comment')
  async editComment(
    @CurrentMembership() membership: MembershipWithOrganization,
    @Param('number', IncidentNumberPipe) number: number,
    @Param('commentId', commentIdPipe) commentId: string,
    @Body() commentContentDto: CommentContentDto,
  ): Promise<CommentBody> {
    const comment = await this.commentsService.editComment(
      membership,
      number,
      commentId,
      commentContentDto.content,
    );

    return { comment };
  }

  @Delete(':number/comments/:commentId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @RequirePermission('incidents:comment')
  async deleteComment(
    @CurrentMembership() membership: MembershipWithOrganization,
    @Param('number', IncidentNumberPipe) number: number,
    @Param('commentId', commentIdPipe) commentId: string,
  ): Promise<void> {
    await this.commentsService.deleteComment(membership, number, commentId);
  }
}
