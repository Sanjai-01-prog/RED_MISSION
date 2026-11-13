import { getDatabase } from '../connection.js';
import { applyStage33Migration } from './stage_3_3_user_consents.js';

const db = getDatabase();
const result = applyStage33Migration(db);
console.log('Stage 3.3 Migration Result:', JSON.stringify(result, null, 2));
