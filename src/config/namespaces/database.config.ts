import { registerAs } from '@nestjs/config';

export type DatabaseConfiguration = {
  host: string;
  port: number;
  user: string;
  password: string;
  name: string;
  connectionLimit: number;
};

export const databaseConfig = registerAs('database', (): DatabaseConfiguration => {
  let host: string = 'localhost';

  if (process.env.DATABASE_HOST !== undefined) {
    host = process.env.DATABASE_HOST;
  }

  let port: number = 3306;

  if (process.env.DATABASE_PORT !== undefined) {
    port = Number(process.env.DATABASE_PORT);
  }

  let user: string = '';

  if (process.env.DATABASE_USER !== undefined) {
    user = process.env.DATABASE_USER;
  }

  let password: string = '';

  if (process.env.DATABASE_PASSWORD !== undefined) {
    password = process.env.DATABASE_PASSWORD;
  }

  let name: string = '';

  if (process.env.DATABASE_NAME !== undefined) {
    name = process.env.DATABASE_NAME;
  }

  let connectionLimit: number = 10;

  if (process.env.DATABASE_CONNECTION_LIMIT !== undefined) {
    connectionLimit = Number(process.env.DATABASE_CONNECTION_LIMIT);
  }

  const configuration: DatabaseConfiguration = {
    host: host,
    port: port,
    user: user,
    password: password,
    name: name,
    connectionLimit: connectionLimit,
  };

  return configuration;
});