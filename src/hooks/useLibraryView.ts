import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../services/db';
export function useLibraryView() {
  const saved = useLiveQuery(() => db.settings.get('library-view'), []);
  const view = saved?.value === 'list' ? 'list' : 'shelf';
  return {
    view,
    setView: (next: 'list' | 'shelf') => db.settings.put({ key: 'library-view', value: next }),
  };
}
