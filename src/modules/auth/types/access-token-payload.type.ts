export type AccessTokenPayload = {

  sub: string;

  sid: string;

  jti: string;

  tokenUse: 'access';

  iat: number;

  exp: number;

};