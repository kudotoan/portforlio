import { AuthAdminResponseDto } from './auth-admin-response.dto.js';

export class LoginResponseDto {
  accessToken: string;
  expiresIn: number;
  admin: AuthAdminResponseDto;
}
