import type { AdminRole } from '../../../generated/prisma/enums.js';

export type CurrentAdmin = {
  id: string;
  username: string;
  role: AdminRole;
  mustChangePassword: boolean;
};