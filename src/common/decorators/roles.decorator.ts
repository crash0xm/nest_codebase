import { SetMetadata } from '@nestjs/common';
import { Role } from '@/common/enums/role.enum';

export const ROLES_KEY = 'roles';

export const Roles = (...roles: Role[]): ReturnType<typeof SetMetadata> =>
  SetMetadata(ROLES_KEY, roles);
