import { createServerlessFunction } from './factory';
import { healthRouter } from '../src/modules/health/health.routes';
export default createServerlessFunction('/api/health', healthRouter);
