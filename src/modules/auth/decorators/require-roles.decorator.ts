
import { SetMetadata } from '@nestjs/common';

import type { AdminRole } from '../../../generated/prisma/enums.js';

export const REQUIRED_ROLES_KEY: string = 'requiredRoles';

export const RequireRoles = (
  ...roles: AdminRole[]
): MethodDecorator & ClassDecorator => {
  return SetMetadata(REQUIRED_ROLES_KEY, roles);
};