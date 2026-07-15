import { createServerlessFunction } from './factory';
import { watchlistsRouter } from '../src/modules/watchlists/watchlists.routes';
export default createServerlessFunction('/api/watchlists', watchlistsRouter);
