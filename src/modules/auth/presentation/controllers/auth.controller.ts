import { Body, Controller, Post, HttpCode, HttpStatus, UseGuards, Req } from '@nestjs/common';
import { FastifyRequest } from 'fastify';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBody as ApiBodyDecorator,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { AuthService } from '../../application/services/auth.service';

import { RefreshTokenDto } from '../dtos/refresh-token.dto';
import { AuthResponseDto } from '../dtos/auth-response.dto';
import { Public } from '@/common/decorators/public.decorator';
import { LocalAuthGuard } from '@/common/guards/local-auth.guard';
import type { AuthUserPayload } from '../../application/services/auth.service';
import type { Role } from '@/modules/user/domain/enums/role.enum';

type LoginRequest = FastifyRequest & { user: AuthUserPayload };

type JwtAttachedUser = {
  id: string;
  email: string;
  role: Role;
  jti: string;
  exp?: number;
};

type LogoutRequest = FastifyRequest & { user: JwtAttachedUser };

@ApiTags('Authentication')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Public()
  @UseGuards(LocalAuthGuard)
  @Post('login')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'User login' })
  @ApiResponse({ status: HttpStatus.OK, type: AuthResponseDto })
  async login(@Req() req: LoginRequest): Promise<AuthResponseDto> {
    const tokens = await this.authService.login(req.user);
    const expiresIn = this.authService.getAccessTokenTtlSeconds();

    return {
      ...tokens,
      expiresIn,
      user: {
        id: req.user.id,
        email: req.user.email,
        role: req.user.role,
      },
    };
  }

  @Public()
  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Refresh access token' })
  @ApiResponse({ status: HttpStatus.OK, type: AuthResponseDto })
  async refreshToken(@Body() refreshTokenDto: RefreshTokenDto): Promise<AuthResponseDto> {
    const tokens = await this.authService.refreshTokens(refreshTokenDto.refreshToken);
    const payload = this.authService.decodePayload(tokens.accessToken);
    const expiresIn = this.authService.getAccessTokenTtlSeconds();

    return {
      ...tokens,
      expiresIn,
      user: {
        id: payload.sub,
        email: payload.email,
        role: payload.role,
      },
    };
  }

  @Post('logout')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Logout user' })
  @ApiBodyDecorator({
    schema: {
      type: 'object',
      properties: {
        refreshToken: {
          type: 'string',
          description: 'Refresh token to revoke (optional)',
          example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
        },
      },
    },
  })
  async logout(@Req() req: LogoutRequest, @Body() body: { refreshToken?: string }): Promise<void> {
    const { user } = req;
    // Revoking access token (blacklist) and refresh token
    await this.authService.logout(user.id, user.jti, body.refreshToken ?? '', {
      exp: user.exp,
    });
  }
}
