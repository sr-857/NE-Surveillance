import { createServerlessFunction } from './factory';
import { integrationsRouter } from '../src/modules/alerts/integrations.routes';
export default createServerlessFunction('/api/admin/integrations', integrationsRouter);
