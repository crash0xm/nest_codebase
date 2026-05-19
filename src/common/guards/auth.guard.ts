import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
  Inject,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import type { FastifyRequest } from 'fastify';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';
import { IS_OPTIONAL_KEY } from '../decorators/optional.decorator';
import { INJECTION_TOKENS } from '@/constants/injection-tokens';
import type { ITokenStore } from '@/common/interfaces/token-store.interface';
import type { AuthConfig } from '@/config/auth/auth-config.type';

// Single source of truth cho req.user trong toàn bộ app.
// authorization.guard.ts và current-user.decorator.ts đều dùng type này.
export interface AuthenticatedUser {
  /** userId — map từ JWT claim `sub` */
  id: string;
  email: string;
  role: string;
  /** JWT ID — dùng để blacklist khi logout */
  jti: string;
  /** Unix timestamp (giây) — dùng để tính TTL blacklist */
  exp: number;
}

export type AuthenticatedRequest = FastifyRequest & {
  user?: AuthenticatedUser;
};

// Raw JWT payload — validate trước khi map sang AuthenticatedUser
interface RawJwtPayload {
  sub: string;
  email: string;
  role: string;
  jti: string;
  exp: number;
  iat?: number;
}

function isValidAccessTokenPayload(value: unknown): value is RawJwtPayload {
  if (typeof value !== 'object' || value === null) return false;
  const o = value as Record<string, unknown>;
  return (
    typeof o.sub === 'string' &&
    o.sub.length > 0 &&
    typeof o.email === 'string' &&
    o.email.length > 0 &&
    typeof o.role === 'string' &&
    o.role.length > 0 &&
    typeof o.jti === 'string' &&
    o.jti.length > 0 &&
    typeof o.exp === 'number'
  );
}

@Injectable()
export class AuthGuard implements CanActivate {
  private readonly accessTokenSecret: string;

  constructor(
    private readonly reflector: Reflector,
    private readonly jwtService: JwtService,
    configService: ConfigService,
    @Inject(INJECTION_TOKENS.TOKEN_STORE)
    private readonly tokenStore: ITokenStore,
  ) {
    // Fail-fast khi khởi động nếu secret chưa được cấu hình
    const authConfig = configService.getOrThrow<AuthConfig>('auth');
    this.accessTokenSecret = authConfig.jwt.accessToken.secret;
  }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) return true;

    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const token = this.extractBearerToken(request);

    if (!token) {
      const isOptional = this.reflector.getAllAndOverride<boolean>(IS_OPTIONAL_KEY, [
        context.getHandler(),
        context.getClass(),
      ]);
      if (isOptional) return true;
      throw new UnauthorizedException('MISSING_TOKEN');
    }

    const payload = await this.verifyAndExtractPayload(token);
    request.user = this.mapToAuthenticatedUser(payload);
    return true;
  }

  /**
   * Chỉ chấp nhận Bearer token từ Authorization header.
   * KHÔNG đọc từ query string — token trong URL bị lộ qua server log,
   * browser history, và Referer header.
   */
  private extractBearerToken(request: FastifyRequest): string | undefined {
    const authHeader = request.headers.authorization;
    if (typeof authHeader === 'string' && authHeader.startsWith('Bearer ')) {
      return authHeader.slice(7);
    }
    return undefined;
  }

  private async verifyAndExtractPayload(token: string): Promise<RawJwtPayload> {
    let rawPayload: unknown;

    try {
      rawPayload = await this.jwtService.verifyAsync(token, {
        secret: this.accessTokenSecret,
        algorithms: ['HS256'], // chặn "alg: none" attack
      });
    } catch {
      // Message chung — không tiết lộ token hết hạn hay chữ ký sai
      throw new UnauthorizedException('INVALID_OR_EXPIRED_TOKEN');
    }

    if (!isValidAccessTokenPayload(rawPayload)) {
      throw new UnauthorizedException('INVALID_TOKEN_PAYLOAD');
    }

    const isBlacklisted = await this.tokenStore.isAccessTokenBlacklisted(rawPayload.jti);
    if (isBlacklisted) {
      throw new UnauthorizedException('TOKEN_REVOKED');
    }

    return rawPayload;
  }

  /**
   * Map raw JWT payload sang AuthenticatedUser.
   * `sub` (JWT standard claim) → `id` (app convention).
   */
  private mapToAuthenticatedUser(payload: RawJwtPayload): AuthenticatedUser {
    return {
      id: payload.sub,
      email: payload.email,
      role: payload.role,
      jti: payload.jti,
      exp: payload.exp,
    };
  }
}
