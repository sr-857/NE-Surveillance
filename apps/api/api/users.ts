import { createServerlessFunction } from './factory';
import { usersRouter } from '../src/modules/users/users.routes';
export default createServerlessFunction('/api/admin/users', usersRouter);
