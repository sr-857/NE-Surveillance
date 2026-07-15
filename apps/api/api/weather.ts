import { createServerlessFunction } from './factory';
import { weatherRouter } from '../src/modules/weather/weather.routes';
export default createServerlessFunction('/api/weather', weatherRouter);
