import { registerAs } from '@nestjs/config';

export type AppConfiguration = {
  nodeEnvironment: string;
  port: number;
};

export const appConfig = registerAs('app', (): AppConfiguration => {
  let nodeEnvironment: string = 'development';

  if (process.env.NODE_ENV !== undefined) {
    nodeEnvironment = process.env.NODE_ENV;
  }

  let port: number = 3000;

  if (process.env.PORT !== undefined) {
    port = Number(process.env.PORT);
  }

  const configuration: AppConfiguration = {
    nodeEnvironment: nodeEnvironment,
    port: port,
  };

  return configuration;
});