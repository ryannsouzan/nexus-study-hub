import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../services/db';
import { learningSnapshot } from '../services/learningState';
export function useLearning() {
  return useLiveQuery(() => db.transaction('r', db.tables, learningSnapshot), []);
}
