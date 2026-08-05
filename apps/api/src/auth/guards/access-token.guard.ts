import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import type { AccessTokenPayload } from '../interfaces/access-token-payload.interface';
import type { AuthenticatedRequest } from '../interfaces/authenticated-request.interface';

@Injectable()
export class AccessTokenGuard implements CanActivate {
  constructor(private readonly jwtService: JwtService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();

    const token = this.extractTokenFromHeader(request);

    if (!token) {
      throw new UnauthorizedException('Authentication required');
    }

    try {
      const decoded: unknown = await this.jwtService.verifyAsync(token);

      if (!this.isAccessTokenPayload(decoded)) {
        throw new UnauthorizedException();
      }

      request.user = decoded;

      return true;
    } catch {
      throw new UnauthorizedException('Invalid or expired access token');
    }
  }

  private extractTokenFromHeader(
    request: AuthenticatedRequest,
  ): string | undefined {
    const authorization = request.headers.authorization;

    if (!authorization) {
      return undefined;
    }

    const [type, token] = authorization.split(' ');

    return type === 'Bearer' ? token : undefined;
  }

  private isAccessTokenPayload(value: unknown): value is AccessTokenPayload {
    if (typeof value !== 'object' || value === null) {
      return false;
    }

    return (
      'sub' in value &&
      typeof value.sub === 'string' &&
      'email' in value &&
      typeof value.email === 'string'
    );
  }
}
