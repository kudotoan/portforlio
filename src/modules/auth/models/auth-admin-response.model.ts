import { AdminRole } from '../../../generated/prisma/enums.js';

export class AuthAdminResponse {

  id: string;

  username: string;

  role: AdminRole;

  mustChangePassword: boolean;

}