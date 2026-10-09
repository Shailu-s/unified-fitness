import { startNutritionServer } from '../_shared/server.ts';

startNutritionServer(Deno.env.get('PHOTO_API_ENABLED') === 'true');
