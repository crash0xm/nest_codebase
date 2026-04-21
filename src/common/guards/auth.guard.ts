import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { FastifyRequest } from 'fastify';
import { Inject } from '@nestjs/common';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';
import { IS_OPTIONAL_KEY } from '../decorators/optional.decorator';
import { INJECTION_TOKENS } from '@/constants/injection-tokens';
import type { ITokenStore } from '@/modules/auth/infrastructure/token-store/redis-token-store';
import { AuthConfig } from '@/config/auth/auth-config.type';

interface AuthenticatedRequest extends FastifyRequest {
  user?: {
    sub: string;
    email: string;
    jti: string;
  };
}

@Injectable()
export class AuthGuard implements CanActivate {
  private readonly authConfig: AuthConfig;

  constructor(
    private readonly reflector: Reflector,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    // Add: inject token store to check blacklist
    @Inject(INJECTION_TOKENS.TOKEN_STORE)
    private readonly tokenStore: ITokenStore,
  ) {
    this.authConfig = this.configService.getOrThrow<AuthConfig>('auth');
  }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (isPublic) return true;

    const request = this.getRequest(context);
    const token = this.extractTokenFromRequest(request);

    if (!token) {
      const isOptional = this.reflector.getAllAndOverride<boolean>(IS_OPTIONAL_KEY, [
        context.getHandler(),
        context.getClass(),
      ]);
      if (isOptional) return true;
      throw new UnauthorizedException('MISSING_TOKEN');
    }

    try {
      const payload = await this.jwtService.verifyAsync(token, {
        secret: this.authConfig.jwt.accessToken.secret,
      });

      if (!payload.sub || !payload.email || !payload.jti) {
        throw new UnauthorizedException('INVALID_TOKEN_PAYLOAD');
      }

      // Add: check if token is blacklisted
      const isBlacklisted = await this.tokenStore.isAccessTokenBlacklisted(payload.jti);
      if (isBlacklisted) {
        throw new UnauthorizedException('TOKEN_REVOKED');
      }

      request.user = payload;

      return true;
    } catch (error) {
      if (process.env.NODE_ENV === 'development') {
        console.error('Auth error:', error);
      }

      throw new UnauthorizedException('INVALID_OR_EXPIRED_TOKEN');
    }
  }

  private getRequest(context: ExecutionContext): AuthenticatedRequest {
    return context.switchToHttp().getRequest<AuthenticatedRequest>();
  }

  private extractTokenFromRequest(request: FastifyRequest): string | undefined {
    const authHeader = request.headers?.authorization;
    if (authHeader?.startsWith('Bearer ')) {
      return authHeader.substring(7);
    }

    return undefined;
  }
}
