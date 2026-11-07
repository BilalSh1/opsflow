import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { Team } from '../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import type {
  TeamDetailResponse,
  TeamMemberResponse,
  TeamSummaryResponse,
} from './interfaces/team-response.interface';

const teamMemberInclude = {
  organizationMember: {
    include: {
      user: {
        select: { id: true, email: true, firstName: true, lastName: true },
      },
    },
  },
} as const;

// Every query is scoped to the organization from the URL, so ids from
// another organization behave as if they do not exist.
@Injectable()
export class TeamsService {
  constructor(private readonly prisma: PrismaService) {}

  async list(organizationId: string): Promise<TeamSummaryResponse[]> {
    const teams = await this.prisma.team.findMany({
      where: { organizationId },
      include: { _count: { select: { members: true } } },
      orderBy: { name: 'asc' },
    });

    return teams.map((team) => ({
      id: team.id,
      name: team.name,
      memberCount: team._count.members,
      createdAt: team.createdAt.toISOString(),
    }));
  }

  async create(
    organizationId: string,
    name: string,
  ): Promise<TeamSummaryResponse> {
    try {
      const team = await this.prisma.team.create({
        data: { organizationId, name: name.trim() },
      });

      return this.toSummary(team, 0);
    } catch (error: unknown) {
      throw this.mapWriteError(error);
    }
  }

  async get(
    organizationId: string,
    teamId: string,
  ): Promise<TeamDetailResponse> {
    const team = await this.prisma.team.findFirst({
      where: { id: teamId, organizationId },
      include: { members: { include: teamMemberInclude } },
    });

    if (!team) {
      throw new NotFoundException('Team not found');
    }

    const members = team.members
      .map((teamMember) => this.toMemberResponse(teamMember))
      .sort(
        (a, b) =>
          a.firstName.localeCompare(b.firstName) ||
          a.lastName.localeCompare(b.lastName),
      );

    return {
      id: team.id,
      name: team.name,
      createdAt: team.createdAt.toISOString(),
      members,
    };
  }

  async rename(
    organizationId: string,
    teamId: string,
    name: string,
  ): Promise<TeamSummaryResponse> {
    await this.findTeam(organizationId, teamId);

    try {
      const team = await this.prisma.team.update({
        where: { id: teamId },
        data: { name: name.trim() },
        include: { _count: { select: { members: true } } },
      });

      return this.toSummary(team, team._count.members);
    } catch (error: unknown) {
      throw this.mapWriteError(error);
    }
  }

  async remove(organizationId: string, teamId: string): Promise<void> {
    const { count } = await this.prisma.team.deleteMany({
      where: { id: teamId, organizationId },
    });

    if (count === 0) {
      throw new NotFoundException('Team not found');
    }
  }

  async addMember(
    organizationId: string,
    teamId: string,
    memberId: string,
  ): Promise<TeamMemberResponse> {
    await this.findTeam(organizationId, teamId);

    const organizationMember = await this.prisma.organizationMember.findFirst({
      where: { id: memberId, organizationId },
    });

    if (!organizationMember) {
      throw new NotFoundException('Member not found');
    }

    try {
      const teamMember = await this.prisma.teamMember.create({
        data: { teamId, organizationMemberId: memberId },
        include: teamMemberInclude,
      });

      return this.toMemberResponse(teamMember);
    } catch (error: unknown) {
      if (this.errorCode(error) === 'P2002') {
        throw new ConflictException('This member is already in the team');
      }

      throw this.mapWriteError(error);
    }
  }

  async removeMember(
    organizationId: string,
    teamId: string,
    memberId: string,
  ): Promise<void> {
    await this.findTeam(organizationId, teamId);

    const { count } = await this.prisma.teamMember.deleteMany({
      where: { teamId, organizationMemberId: memberId },
    });

    if (count === 0) {
      throw new NotFoundException('This member is not in the team');
    }
  }

  private async findTeam(
    organizationId: string,
    teamId: string,
  ): Promise<Team> {
    const team = await this.prisma.team.findFirst({
      where: { id: teamId, organizationId },
    });

    if (!team) {
      throw new NotFoundException('Team not found');
    }

    return team;
  }

  private toSummary(team: Team, memberCount: number): TeamSummaryResponse {
    return {
      id: team.id,
      name: team.name,
      memberCount,
      createdAt: team.createdAt.toISOString(),
    };
  }

  private toMemberResponse(teamMember: {
    createdAt: Date;
    organizationMember: {
      id: string;
      userId: string;
      role: TeamMemberResponse['role'];
      user: { email: string; firstName: string; lastName: string };
    };
  }): TeamMemberResponse {
    const { organizationMember } = teamMember;

    return {
      memberId: organizationMember.id,
      userId: organizationMember.userId,
      email: organizationMember.user.email,
      firstName: organizationMember.user.firstName,
      lastName: organizationMember.user.lastName,
      role: organizationMember.role,
      addedAt: teamMember.createdAt.toISOString(),
    };
  }

  // P2002: the team name is taken. P2025/P2003: the team or member was
  // deleted between the lookup and the write.
  private mapWriteError(error: unknown): unknown {
    switch (this.errorCode(error)) {
      case 'P2002':
        return new ConflictException('A team with this name already exists');
      case 'P2025':
        return new NotFoundException('Team not found');
      case 'P2003':
        return new NotFoundException('Team or member not found');
      default:
        return error;
    }
  }

  private errorCode(error: unknown): unknown {
    return typeof error === 'object' && error !== null && 'code' in error
      ? error.code
      : undefined;
  }
}
