import type { Request } from 'express';
import type { AccessTokenPayload } from './access-token-payload.interface';

export interface AuthenticatedRequest extends Request {
  user?: AccessTokenPayload;
}
