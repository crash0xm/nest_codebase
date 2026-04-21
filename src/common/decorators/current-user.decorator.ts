import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import type { AuthUserPayload } from '@/modules/auth/application/services/auth.service';
import { FastifyRequest } from 'fastify';

export interface RequestWithUser extends FastifyRequest {
  user?: AuthUserPayload;
}
export const CurrentUser = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): AuthUserPayload | undefined => {
    const request = ctx.switchToHttp().getRequest<RequestWithUser>();
    return request.user;
  },
);
