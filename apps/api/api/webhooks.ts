import { createServerlessFunction } from './factory';
import { webhookRouter } from '../src/modules/alerts/webhook.routes';
export default createServerlessFunction('/api/webhooks', webhookRouter);
