import Joi from 'joi';

export const environmentValidationSchema: Joi.ObjectSchema = Joi.object({
  NODE_ENV: Joi.string()
    .valid('development', 'test', 'production')
    .default('development'),
  
  PORT: Joi.number()
    .integer()
    .min(1)
    .max(65535)
    .default(3000),

  LOG_LEVEL: Joi.string()
    .valid(
      'fatal',
      'error',
      'warn',
      'info',
      'debug',
      'trace',
      'silent',
    )
    .default('info'),
    
    CORS_ORIGIN: Joi.string().uri().required(),
    
    DATABASE_URL: Joi.string().required(),
    DATABASE_HOST: Joi.string().required(),
    DATABASE_PORT: Joi.number().port().default(3306),
    DATABASE_USER: Joi.string().required(),
    DATABASE_PASSWORD: Joi.string().required(),
    DATABASE_NAME: Joi.string().required(),
    DATABASE_CONNECTION_LIMIT: Joi.number().integer().min(1).default(10),
    
    RATE_LIMIT_TTL_MS: Joi.number().integer().positive().required(),
    RATE_LIMIT_LIMIT: Joi.number().integer().positive().required(),

    JWT_ACCESS_PRIVATE_KEY_PATH: Joi.string().trim().required(),

    JWT_ACCESS_PUBLIC_KEY_PATH: Joi.string().trim().required(),

    JWT_ACCESS_ISSUER: Joi.string().trim().required(),

    JWT_ACCESS_AUDIENCE: Joi.string().trim().required(),

    JWT_ACCESS_TTL_SECONDS: Joi.number().integer().positive().required(),

    REFRESH_IDLE_TTL_SECONDS: Joi.number().integer().positive().required(),

    REFRESH_FAMILY_TTL_SECONDS: Joi.number().integer().positive().required(),

    REFRESH_COOKIE_NAME: Joi.string().trim().required(),

    REFRESH_COOKIE_PATH: Joi.string().trim().required(),

    REFRESH_COOKIE_SECURE: Joi.boolean().required(),

    REFRESH_COOKIE_SAME_SITE: Joi.string().valid('strict', 'lax', 'none').required(),

    AUTH_ALLOWED_ORIGINS: Joi.string().trim().required(),
});