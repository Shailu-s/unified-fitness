import { startNutritionServer } from '../_shared/server.ts';

startNutritionServer(Deno.env.get('PHOTO_PREVIEW_API_ENABLED') === 'true');
