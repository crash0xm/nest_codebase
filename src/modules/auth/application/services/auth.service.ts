import { Inject, Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { v4 as uuidv4 } from 'uuid';

import { ClsService } from 'nestjs-cls';
import type { Role } from '../../../user/domain/enums/role.enum';
import type { AppClsStore } from '@/modules/cls/cls.module';
import type { IUserRepository } from '../../../user/domain/repositories/user.repository.interface';
import { type ITokenStore } from '../../infrastructure/token-store/redis-token-store';
import { USER_REPOSITORY, INJECTION_TOKENS } from '@/constants/injection-tokens';
import {
  AccountDeletedError,
  AccountInactiveError,
  InvalidCredentialsError,
  InvalidTokenStructureError,
  TokenRevokedError,
} from '@/common/domain/errors/application.error';

export interface AuthConfig {
  accessToken: { secret: string; expiresIn: string };
  refreshToken: { secret: string; expiresIn: string };
  tokenBlacklistTtlSeconds: number;
}
const AUTH_CONFIG_KEY = 'auth';

export interface JwtPayload {
  sub: string; // userId
  email: string;
  role: Role;
  jti: string; // unique token id
  iat?: number;
  exp?: number;
}

export interface TokenPair {
  accessToken: string;
  refreshToken: string;
}

export interface AuthUserPayload {
  id: string;
  email: string;
  role: Role;
  isActive: boolean;
}

import { InjectMetric } from '@willsoto/nestjs-prometheus';
import { Gauge } from 'prom-client';

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    @Inject(USER_REPOSITORY) private readonly userRepository: IUserRepository,
    private readonly jwtService: JwtService,
    private readonly cls: ClsService<AppClsStore>,
    @Inject(INJECTION_TOKENS.TOKEN_STORE)
    private readonly tokenStore: ITokenStore,
    private readonly configService: ConfigService,
    @InjectMetric('active_sessions_total')
    private readonly sessionsGauge: Gauge,
  ) {}

  private get authConf(): AuthConfig {
    const auth = this.configService.get(AUTH_CONFIG_KEY);
    return {
      accessToken: auth?.jwt?.accessToken || {
        secret: 'secret',
        expiresIn: '15m',
      },
      refreshToken: auth?.jwt?.refreshToken || {
        secret: 'secret',
        expiresIn: '7d',
      },
      tokenBlacklistTtlSeconds: auth?.tokenBlacklistTtlSeconds || 604800,
    };
  }

  async validateUser(email: string, password: string): Promise<AuthUserPayload> {
    const user = await this.userRepository.findByEmail(email);

    if (!user) throw new InvalidCredentialsError();
    if (user.isDeleted) throw new AccountDeletedError(user.id);
    if (!user.isActive) throw new AccountInactiveError(user.id);

    const isValid = await user.validatePassword(password);
    if (!isValid) throw new InvalidCredentialsError();

    return {
      id: user.id,
      email: user.email,
      role: user.role,
      isActive: user.isActive,
    };
  }

  async login(user: AuthUserPayload): Promise<TokenPair> {
    const tokens = await this.issueTokenPair(user);
    this.cls.set('userId', user.id);
    this.cls.set('userRole', user.role);
    this.logger.log(`[Auth] Login success: userId=${user.id} traceId=${this.cls.get('traceId')}`);
    return tokens;
  }

  async refreshTokens(refreshToken: string): Promise<TokenPair> {
    let payload: JwtPayload;
    try {
      payload = await this.jwtService.verifyAsync<JwtPayload>(refreshToken, {
        secret: this.authConf.refreshToken.secret,
      });
    } catch (e) {
      this.logger.warn(
        `Refresh token verification failed: ${(e as Error).message}`,
      );
      throw new TokenRevokedError();
    }

    const userId = payload.sub;
    const tokenId = payload.jti;

    // Verify against Redis (existence and hash)
    const isValid = await this.tokenStore.verify(userId, tokenId, refreshToken);
    if (!isValid) {
      this.logger.warn(`Refresh token reuse or invalid: userId=${userId} tokenId=${tokenId}`);
      await this.tokenStore.revokeAll(userId);
      throw new UnauthorizedException('Invalid refresh token');
    }

    // Get user to ensure they still exist and are active
    const user = await this.userRepository.findById(userId);
    if (!user || !user.isActive || user.isDeleted) {
      await this.tokenStore.revokeAll(userId);
      throw new UnauthorizedException('User no longer active');
    }

    // Revoke OLD token (Rotation)
    await this.tokenStore.revoke(userId, tokenId);

    // Issue NEW pair
    return this.issueTokenPair({
      id: user.id,
      email: user.email,
      role: user.role,
      isActive: user.isActive,
    });
  }

  async logout(
    userId: string,
    jti: string,
    _refreshTokenId: string,
    accessTokenPayload?: { exp?: number },
  ): Promise<void> {
    // 1. Blacklist access token with proper TTL from token expiry
    let blacklistTtl = 900; // fallback 15 mins

    if (accessTokenPayload?.exp) {
      // Calculate TTL from token's exp claim
      const currentTime = Math.floor(Date.now() / 1000);
      blacklistTtl = Math.max(0, accessTokenPayload.exp - currentTime);
    }

    await this.tokenStore.blacklistAccessToken(jti, blacklistTtl);

    // Revoke all refresh tokens for the user to ensure complete logout
    await this.tokenStore.revokeAll(userId);
    this.sessionsGauge.dec();

    this.logger.log(
      `[Auth] Logout: userId=${userId}, jti=${jti}, ttl=${blacklistTtl}s - all tokens revoked`,
    );
  }

  async logoutAllDevices(userId: string): Promise<void> {
    await this.tokenStore.revokeAll(userId);
    this.logger.warn(`[Auth] Logout all devices: userId=${userId}`);
  }

  private async issueTokenPair(user: AuthUserPayload): Promise<TokenPair> {
    const accessTokenId = uuidv4();
    const refreshTokenId = uuidv4();

    const [accessToken, refreshToken] = await Promise.all([
      this.jwtService.signAsync(
        {
          sub: user.id,
          email: user.email,
          role: user.role,
          jti: accessTokenId,
        },
        {
          secret: this.authConf.accessToken.secret,
          expiresIn: this.authConf.accessToken.expiresIn,
        } as any,
      ),
      this.jwtService.signAsync({ sub: user.id, jti: refreshTokenId }, {
        secret: this.authConf.refreshToken.secret,
        expiresIn: this.authConf.refreshToken.expiresIn,
      } as any),
    ]);

    // Store refresh token (TTL = 7 days)
    // The store hashes it before saving
    await this.tokenStore.save(
      user.id,
      refreshTokenId,
      refreshToken,
      604800, // 7 days in seconds
    );

    this.sessionsGauge.inc();

    return { accessToken, refreshToken };
  }

  decodePayload(token: string): JwtPayload {
    try {
      return this.jwtService.decode<JwtPayload>(token);
    } catch {
      throw new InvalidTokenStructureError();
    }
  }
}
