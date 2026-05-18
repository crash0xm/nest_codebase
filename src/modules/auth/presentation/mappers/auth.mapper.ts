import { UserEntity } from '../../../user/domain/entities/user.entity';
import { AuthResponseDto, AuthMeResponseDto } from '../dtos/auth-response.dto';
import type { Role } from '../../../user/domain/enums/role.enum';
import { TokenPair } from '../../application/services/auth.service';

export class AuthMapper {
  static toAuthResponse(
    tokens: TokenPair,
    user: { id: string; email: string; role: Role },
    expiresIn: number,
  ): AuthResponseDto {
    return {
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
      expiresIn,
      user: {
        id: user.id,
        email: user.email,
        role: user.role,
      },
    };
  }

  static toMeResponse(entity: UserEntity): AuthMeResponseDto {
    return {
      id: entity.id,
      email: entity.email,
      fullName: entity.fullName,
      systemRole: entity.role,
      isActive: entity.isActive,
      isEmailVerified: entity.isEmailVerified,
      createdAt: entity.createdAt,
      updatedAt: entity.updatedAt,
    };
  }
}
