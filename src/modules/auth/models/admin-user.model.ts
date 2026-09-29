import type { AdminRole } from '../../../generated/prisma/enums.js';

export type AuthAdminUser = {
  id: string;
  username: string;
  passwordHash: string;
  role: AdminRole;
  isActive: boolean;
  mustChangePassword: boolean;
  createdAt: Date;
  updatedAt: Date;
};
