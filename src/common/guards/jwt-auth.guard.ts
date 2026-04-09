import { Injectable, ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { Reflector } from '@nestjs/core';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';
import { INJECTION_TOKENS } from '@/constants/injection-tokens';
import { Inject } from '@nestjs/common';
import type { ITokenStore } from '@/modules/auth/infrastructure/token-store/redis-token-store';

@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
  constructor(
    private reflector: Reflector,
    @Inject(INJECTION_TOKENS.TOKEN_STORE)
    private readonly tokenStore: ITokenStore,
  ) {
    super();
  }

  async canActivate(context: ExecutionContext) {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) {
      return true;
    }

    // Let the parent AuthGuard handle JWT validation first
    const result = await super.canActivate(context);
    if (!result) {
      return false;
    }

    // Additional blacklist check
    const request = context.switchToHttp().getRequest();
    const { user } = request;

    if (user?.jti) {
      const isBlacklisted = await this.tokenStore.isAccessTokenBlacklisted(user.jti);
      if (isBlacklisted) {
        throw new UnauthorizedException('TOKEN_REVOKED');
      }
    }

    return true;
  }
}
