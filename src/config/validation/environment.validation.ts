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
});