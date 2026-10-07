import type { Request } from 'express';

import type { CurrentAdmin } from '../models/current-admin.model.js';

export type AuthenticatedRequest = Request & {
  currentAdmin: CurrentAdmin;
};