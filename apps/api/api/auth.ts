import { createServerlessFunction } from './factory';
import { authRouter } from '../src/modules/auth/auth.routes';
import { rateLimit } from '../src/middleware/rateLimit';

export default createServerlessFunction('/api/auth', authRouter);
