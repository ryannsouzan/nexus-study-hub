import { db } from './db';
import {
  areaInputSchema,
  projectInputSchema,
  taskInputSchema,
  resourceInputSchema,
  backupSchema,
  type AreaInput,
  type ProjectInput,
  type TaskInput,
  type ResourceInput,
  type EntityKind,
  type Backup,
  type Activity,
} from '../models/schema';
const tables = () => [
  db.areas,
  db.projects,
  db.tasks,
  db.resources,
  db.competencies,
  db.activities,
  db.settings,
];
function meta(existing?: { id: string; createdAt: string; example: boolean }) {
  const now = new Date().toISOString();
  return {
    id: existing?.id ?? crypto.randomUUID(),
    createdAt: existing?.createdAt ?? now,
    updatedAt: now,
    example: existing?.example ?? false,
  };
}
async function log(
  entity: EntityKind,
  entityId: string,
  label: string,
  action: Activity['action'],
  example: boolean,
) {
  await db.activities.add({
    id: crypto.randomUUID(),
    entity,
    entityId,
    label,
    action,
    at: new Date().toISOString(),
    example,
  });
}
async function exists(table: typeof db.areas | typeof db.projects, id: string) {
  if (id && !(await table.get(id)))
    throw new Error('O registro associado não existe mais. Atualize a seleção.');
}
export async function saveArea(input: AreaInput, id?: string) {
  const data = areaInputSchema.parse(input);
  return db.transaction('rw', tables(), async () => {
    const old = id ? await db.areas.get(id) : undefined;
    if (id && !old) throw new Error('Área não encontrada.');
    const record = { ...data, ...meta(old) };
    await db.areas.put(record);
    await log('area', record.id, record.name, old ? 'updated' : 'created', record.example);
    return record.id;
  });
}
export async function saveProject(input: ProjectInput, id?: string) {
  const data = projectInputSchema.parse(input);
  return db.transaction('rw', tables(), async () => {
    await exists(db.areas, data.areaId);
    const old = id ? await db.projects.get(id) : undefined;
    if (id && !old) throw new Error('Projeto não encontrado.');
    const record = { ...data, ...meta(old) };
    await db.projects.put(record);
    await log('project', record.id, record.name, old ? 'updated' : 'created', record.example);
    return record.id;
  });
}
export async function saveTask(input: TaskInput, id?: string) {
  const data = taskInputSchema.parse(input);
  return db.transaction('rw', tables(), async () => {
    await exists(db.projects, data.projectId);
    const old = id ? await db.tasks.get(id) : undefined;
    if (id && !old) throw new Error('Tarefa não encontrada.');
    const record = {
      ...data,
      ...meta(old),
      completedAt:
        data.status === 'concluida' ? (old?.completedAt ?? new Date().toISOString()) : null,
    };
    await db.tasks.put(record);
    await log(
      'task',
      record.id,
      record.title,
      data.status === 'concluida' && old?.status !== 'concluida'
        ? 'completed'
        : old?.status === 'concluida' && data.status !== 'concluida'
          ? 'reopened'
          : old
            ? 'updated'
            : 'created',
      record.example,
    );
    return record.id;
  });
}
export async function saveResource(input: ResourceInput, id?: string) {
  const data = resourceInputSchema.parse(input);
  return db.transaction('rw', tables(), async () => {
    await exists(db.areas, data.areaId);
    for (const projectId of data.projectIds) await exists(db.projects, projectId);
    const old = id ? await db.resources.get(id) : undefined;
    if (id && !old) throw new Error('Recurso não encontrado.');
    const record = {
      ...data,
      projectIds: [...new Set(data.projectIds)],
      tags: [...new Set(data.tags)],
      ...meta(old),
    };
    await db.resources.put(record);
    await log('resource', record.id, record.title, old ? 'updated' : 'created', record.example);
    return record.id;
  });
}
// Exclusões preservam entidades independentes e removem apenas associações.
export async function deleteEntity(kind: EntityKind, id: string) {
  await db.transaction('rw', tables(), async () => {
    if (kind === 'area') {
      await db.projects.where('areaId').equals(id).modify({ areaId: '' });
      await db.resources.where('areaId').equals(id).modify({ areaId: '' });
      await db.competencies.toCollection().modify((c) => {
        c.areaIds = c.areaIds.filter((x) => x !== id);
      });
      await db.areas.delete(id);
    }
    if (kind === 'project') {
      await db.tasks.where('projectId').equals(id).modify({ projectId: '' });
      await db.resources.toCollection().modify((r) => {
        r.projectIds = r.projectIds.filter((x) => x !== id);
      });
      await db.competencies.toCollection().modify((c) => {
        c.projectIds = c.projectIds.filter((x) => x !== id);
      });
      await db.projects.delete(id);
    }
    if (kind === 'task') await db.tasks.delete(id);
    if (kind === 'resource') await db.resources.delete(id);
    await db.activities.where('entityId').equals(id).delete();
  });
}
export async function exportBackup(): Promise<Backup> {
  return db.transaction('r', tables(), async () => ({
    schemaVersion: 1,
    exportedAt: new Date().toISOString(),
    areas: await db.areas.toArray(),
    projects: await db.projects.toArray(),
    tasks: await db.tasks.toArray(),
    resources: await db.resources.toArray(),
    competencies: await db.competencies.toArray(),
    activities: await db.activities.toArray(),
  }));
}
export function validateBackup(raw: unknown): Backup {
  const parsed = backupSchema.safeParse(raw);
  if (!parsed.success)
    throw new Error('Backup inválido ou versão incompatível. Nenhum dado foi alterado.');
  const data = parsed.data;
  for (const items of [
    data.areas,
    data.projects,
    data.tasks,
    data.resources,
    data.competencies,
    data.activities,
  ]) {
    if (new Set(items.map((x) => x.id)).size !== items.length)
      throw new Error('O backup contém IDs duplicados.');
  }
  const areas = new Set(data.areas.map((a) => a.id));
  const projects = new Set(data.projects.map((p) => p.id));
  if (
    data.projects.some((p) => p.areaId && !areas.has(p.areaId)) ||
    data.tasks.some((t) => t.projectId && !projects.has(t.projectId)) ||
    data.resources.some(
      (r) => (r.areaId && !areas.has(r.areaId)) || r.projectIds.some((id) => !projects.has(id)),
    ) ||
    data.competencies.some(
      (c) => c.areaIds.some((id) => !areas.has(id)) || c.projectIds.some((id) => !projects.has(id)),
    )
  )
    throw new Error('O backup contém relacionamentos inválidos.');
  const ids = {
    area: areas,
    project: projects,
    task: new Set(data.tasks.map((t) => t.id)),
    resource: new Set(data.resources.map((r) => r.id)),
  };
  if (data.activities.some((a) => !ids[a.entity].has(a.entityId)))
    throw new Error('O histórico contém relacionamentos inválidos.');
  return data;
}
export async function importBackup(raw: unknown) {
  const data = validateBackup(raw);
  await db.transaction('rw', tables(), async () => {
    for (const table of tables()) if (table !== db.settings) await table.clear();
    await db.areas.bulkAdd(data.areas);
    await db.projects.bulkAdd(data.projects);
    await db.tasks.bulkAdd(data.tasks);
    await db.resources.bulkAdd(data.resources);
    await db.competencies.bulkAdd(data.competencies);
    await db.activities.bulkAdd(data.activities);
    await db.settings.put({ key: 'initialized', value: 'true' });
  });
}
export async function removeExamples() {
  await db.transaction('rw', tables(), async () => {
    for (const a of await db.areas.toArray()) if (a.example) await deleteEntity('area', a.id);
    for (const p of await db.projects.toArray()) if (p.example) await deleteEntity('project', p.id);
    for (const t of await db.tasks.toArray()) if (t.example) await deleteEntity('task', t.id);
    for (const r of await db.resources.toArray())
      if (r.example) await deleteEntity('resource', r.id);
    await db.competencies
      .toCollection()
      .filter((c) => c.example)
      .delete();
    await db.activities
      .toCollection()
      .filter((a) => a.example)
      .delete();
    await db.settings.put({ key: 'initialized', value: 'true' });
  });
}
