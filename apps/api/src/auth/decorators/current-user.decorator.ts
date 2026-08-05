import {
  createParamDecorator,
  ExecutionContext,
  UnauthorizedException,
} from '@nestjs/common';
import type { AccessTokenPayload } from '../interfaces/access-token-payload.interface';
import type { AuthenticatedRequest } from '../interfaces/authenticated-request.interface';

export const CurrentUser = createParamDecorator(
  (_data: unknown, context: ExecutionContext): AccessTokenPayload => {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();

    if (!request.user) {
      throw new UnauthorizedException('Authentication required');
    }

    return request.user;
  },
);
