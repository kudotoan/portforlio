import type { AdminRole } from '../../../../generated/prisma/enums.js';

export class AuthAdminResponseDto {
  id: string;
  username: string;
  role: AdminRole;
  mustChangePassword: boolean;
}
