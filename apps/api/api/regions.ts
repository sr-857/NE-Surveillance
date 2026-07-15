import { createServerlessFunction } from './factory';
import { regionsRouter } from '../src/modules/regions/regions.routes';
export default createServerlessFunction('/api/regions', regionsRouter);
