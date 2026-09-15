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
});