import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../services/db';
export function useWorkspace() {
  return useLiveQuery(
    () =>
      db.transaction(
        'r',
        [db.areas, db.projects, db.tasks, db.resources, db.activities],
        async () => ({
          areas: await db.areas.toArray(),
          projects: await db.projects.toArray(),
          tasks: await db.tasks.toArray(),
          resources: await db.resources.toArray(),
          activities: await db.activities.orderBy('at').reverse().toArray(),
        }),
      ),
    [],
  );
}
export type Workspace = NonNullable<ReturnType<typeof useWorkspace>>;
