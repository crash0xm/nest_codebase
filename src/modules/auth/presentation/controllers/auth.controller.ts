import {
  Body,
  Controller,
  Post,
  Patch,
  HttpCode,
  HttpStatus,
  UseGuards,
  Req,
  Get,
} from '@nestjs/common';
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
import { RegisterDto } from '../dtos/register.dto';
import { ForgotPasswordDto } from '../dtos/forgot-password.dto';
import { ResetPasswordDto } from '../dtos/reset-password.dto';
import { ChangePasswordDto } from '../dtos/change-password.dto';
import { AuthResponseDto, AuthMeResponseDto } from '../dtos/auth-response.dto';
import { Public } from '@/common/decorators/public.decorator';
import { LocalAuthGuard } from '@/common/guards/local-auth.guard';
import type { AuthUserPayload } from '../../application/services/auth.service';
import { AuthMapper } from '../mappers/auth.mapper';
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
  @Post('register')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'User registration' })
  @ApiResponse({ status: HttpStatus.CREATED, type: AuthResponseDto })
  async register(@Body() registerDto: RegisterDto): Promise<AuthResponseDto> {
    const { user, tokens } = await this.authService.register(
      registerDto.email,
      registerDto.password,
      registerDto.fullName,
    );
    const expiresIn = this.authService.getAccessTokenTtlSeconds();
    return AuthMapper.toAuthResponse(tokens, user, expiresIn);
  }

  @Public()
  @UseGuards(LocalAuthGuard)
  @Post('login')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'User login' })
  @ApiResponse({ status: HttpStatus.OK, type: AuthResponseDto })
  async login(@Req() req: LoginRequest): Promise<AuthResponseDto> {
    const tokens = await this.authService.login(req.user);
    const expiresIn = this.authService.getAccessTokenTtlSeconds();
    return AuthMapper.toAuthResponse(tokens, req.user, expiresIn);
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
    return AuthMapper.toAuthResponse(
      tokens,
      {
        id: payload.sub,
        email: payload.email,
        role: payload.role,
      },
      expiresIn,
    );
  }

  @Get('me')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get current user info' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Current user information',
    type: AuthMeResponseDto,
  })
  async getMe(@Req() req: LogoutRequest): Promise<AuthMeResponseDto> {
    const { user } = req;
    const fullUser = await this.authService.getUserById(user.id);
    return AuthMapper.toMeResponse(fullUser);
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

  @Post('logout-all')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Logout from all devices' })
  async logoutAll(@Req() req: LogoutRequest): Promise<void> {
    const { user } = req;
    // Revoke all refresh tokens for the user
    await this.authService.logoutAllDevices(user.id);
  }

  @Public()
  @Post('forgot-password')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Send password reset email' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Password reset email sent (if email exists)',
    schema: {
      type: 'object',
      properties: {
        success: { type: 'boolean', example: true },
        message: { type: 'string', example: 'If email exists, reset instructions have been sent' },
      },
    },
  })
  async forgotPassword(
    @Body() forgotPasswordDto: ForgotPasswordDto,
  ): Promise<{ success: boolean; message: string }> {
    await this.authService.forgotPassword(forgotPasswordDto.email);
    return {
      success: true,
      message: 'If email exists, reset instructions have been sent',
    };
  }

  @Public()
  @Post('reset-password')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Reset password with token' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Password reset successful',
    schema: {
      type: 'object',
      properties: {
        success: { type: 'boolean', example: true },
        message: { type: 'string', example: 'Password reset successful' },
      },
    },
  })
  async resetPassword(
    @Body() resetPasswordDto: ResetPasswordDto,
  ): Promise<{ success: boolean; message: string }> {
    await this.authService.resetPassword(resetPasswordDto.token, resetPasswordDto.newPassword);
    return {
      success: true,
      message: 'Password reset successful',
    };
  }

  @Patch('change-password')
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Change password (requires current password)' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Password changed successful',
    schema: {
      type: 'object',
      properties: {
        success: { type: 'boolean', example: true },
        message: { type: 'string', example: 'Password changed successful' },
      },
    },
  })
  async changePassword(
    @Req() req: LogoutRequest,
    @Body() changePasswordDto: ChangePasswordDto,
  ): Promise<{ success: boolean; message: string }> {
    await this.authService.changePassword(
      req.user.id,
      changePasswordDto.currentPassword,
      changePasswordDto.newPassword,
    );
    return {
      success: true,
      message: 'Password changed successful',
    };
  }
}
