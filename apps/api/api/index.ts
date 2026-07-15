import serverless from 'serverless-http';
import { createApp } from '../src/app';

// Re-use the full Express app — every route is already mounted inside createApp().
// Vercel rewrites all /api/* traffic to this single function via vercel.json.
const app = createApp();

export default serverless(app);
