import { AuthAdminResponse } from './auth-admin-response.model.js';

export class LoginResponse {

  accessToken: string;

  expiresIn: number;

  admin: AuthAdminResponse;

}