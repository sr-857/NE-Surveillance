import { createServerlessFunction } from './factory';
import { alertsRouter } from '../src/modules/alerts/alerts.routes';
export default createServerlessFunction('/api/alerts', alertsRouter);
