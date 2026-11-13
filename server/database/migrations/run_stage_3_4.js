import { getDatabase } from '../connection.js';
import { applyStage34Migration } from './stage_3_4_emergency_lifecycle.js';

const db = getDatabase();
const result = applyStage34Migration(db);
console.log('Stage 3.4 Migration Result:', JSON.stringify(result, null, 2));
