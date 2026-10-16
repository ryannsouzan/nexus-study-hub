import { db } from './db';
import { emptyLearning } from '../models/learning';
import { validateLearningData } from '../domain/learning';
import { learningSnapshot, reconcileLearningState, removePathRecords } from './learningState';
import { bookDefaults, normalizeIsbn } from '../models/books';
import {
  blobBytes,
  bytesToBase64,
  base64ToBytes,
  detectedMime,
  prepareCoverAsset,
  MAX_STORED_COVER_BYTES,
} from './covers';
import {
  areaInputSchema,
  projectInputSchema,
  taskInputSchema,
  resourceInputSchema,
  backupSchema,
  legacyBackupSchema,
  previousBackupSchema,
  type AreaInput,
  type ProjectInput,
  type TaskInput,
  type ResourceInput,
  type EntityKind,
  type Backup,
  type Activity,
} from '../models/schema';
const tables = () => db.tables;
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
    await reconcileLearningState();
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
async function removeUnusedCover(id?: string) {
  if (id && !(await db.resources.where('coverId').equals(id).count())) await db.covers.delete(id);
}
export async function saveResource(input: ResourceInput, id?: string, coverChange?: Blob | null) {
  const asset = coverChange ? await prepareCoverAsset(coverChange) : null;
  const data = resourceInputSchema.parse({
    ...bookDefaults,
    ...input,
    ...(coverChange !== undefined
      ? { coverId: asset?.id ?? '', ...(asset ? { coverUrl: '' } : {}) }
      : {}),
  });
  if (data.type !== 'livro') {
    data.coverId = '';
    data.coverUrl = '';
  }
  return db.transaction('rw', tables(), async () => {
    await exists(db.areas, data.areaId);
    for (const projectId of data.projectIds) await exists(db.projects, projectId);
    const old = id ? await db.resources.get(id) : undefined;
    if (id && !old) throw new Error('Recurso não encontrado.');
    if (asset && data.type === 'livro') await db.covers.put(asset);
    if (data.coverId && !(await db.covers.get(data.coverId)))
      throw new Error('A capa local não foi encontrada. Selecione a imagem novamente.');
    const record = {
      ...data,
      isbnNormalized: normalizeIsbn(data.isbn ?? ''),
      projectIds: [...new Set(data.projectIds)],
      tags: [...new Set(data.tags)],
      ...meta(old),
    };
    await db.resources.put(record);
    await removeUnusedCover(old?.coverId);
    await log('resource', record.id, record.title, old ? 'updated' : 'created', record.example);
    return record.id;
  });
}
// Exclusões preservam entidades independentes e removem apenas associações.
export async function deleteEntity(kind: EntityKind, id: string) {
  await db.transaction('rw', tables(), async () => {
    if (kind === 'area') {
      await db.learningPaths.where('areaId').equals(id).modify({ areaId: '' });
      await db.projects.where('areaId').equals(id).modify({ areaId: '' });
      await db.resources.where('areaId').equals(id).modify({ areaId: '' });
      await db.competencies.toCollection().modify((c) => {
        c.areaIds = c.areaIds.filter((x) => x !== id);
      });
      await db.areas.delete(id);
    }
    if (kind === 'project') {
      await db.learningPaths.where('projectId').equals(id).modify({ projectId: '' });
      await db.tasks.where('projectId').equals(id).modify({ projectId: '' });
      await db.resources.toCollection().modify((r) => {
        r.projectIds = r.projectIds.filter((x) => x !== id);
      });
      await db.competencies.toCollection().modify((c) => {
        c.projectIds = c.projectIds.filter((x) => x !== id);
      });
      await db.projects.delete(id);
    }
    if (kind === 'task') {
      await db.learningStageTasks.where('taskId').equals(id).delete();
      await db.learningCriteria.where('[type+targetId]').equals(['task', id]).delete();
      await db.tasks.delete(id);
    }
    if (kind === 'resource') {
      await db.learningStageResources.where('resourceId').equals(id).delete();
      const resource = await db.resources.get(id);
      await db.resources.delete(id);
      await removeUnusedCover(resource?.coverId);
    }
    await db.activities.where('entityId').equals(id).delete();
    await reconcileLearningState();
  });
}
export async function exportBackup(): Promise<Backup> {
  const snapshot = await db.transaction('r', tables(), async () => ({
    schemaVersion: 3 as const,
    ...(await learningSnapshot()),
    exportedAt: new Date().toISOString(),
    areas: await db.areas.toArray(),
    projects: await db.projects.toArray(),
    resources: await db.resources.toArray(),
    competencies: await db.competencies.toArray(),
    activities: await db.activities.toArray(),
    covers: await db.covers.toArray(),
  }));
  return {
    ...snapshot,
    covers: await Promise.all(
      snapshot.covers.map(async (cover) => ({
        id: cover.id,
        mime: cover.mime,
        width: cover.width,
        height: cover.height,
        data: bytesToBase64(await blobBytes(cover.blob)),
      })),
    ),
  };
}
export function validateBackup(raw: unknown): Backup {
  const legacy = legacyBackupSchema.safeParse(raw);
  const previous = previousBackupSchema.safeParse(raw);
  const parsed = backupSchema.safeParse(
    legacy.success
      ? { ...legacy.data, schemaVersion: 3, covers: [], ...emptyLearning }
      : previous.success
        ? { ...previous.data, schemaVersion: 3, ...emptyLearning }
        : raw,
  );
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
    data.covers,
    ...Object.keys(emptyLearning).map((key) => data[key as keyof typeof emptyLearning]),
  ]) {
    if (new Set(items.map((x) => x.id)).size !== items.length)
      throw new Error('O backup contém IDs duplicados.');
  }
  const coverIds = new Set(data.covers.map((c) => c.id));
  if (
    data.resources.some(
      (r) =>
        (r.coverId && !coverIds.has(r.coverId)) ||
        (r.type !== 'livro' && (r.coverId || r.coverUrl)),
    )
  )
    throw new Error('O backup contém vínculos de capas inválidos.');
  if (data.covers.some((c) => !data.resources.some((r) => r.coverId === c.id)))
    throw new Error('O backup contém capas sem livro associado.');
  for (const c of data.covers) {
    const bytes = base64ToBytes(c.data);
    if (bytes.length > MAX_STORED_COVER_BYTES || detectedMime(bytes) !== c.mime)
      throw new Error('O backup contém uma imagem inválida.');
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
  validateLearningData(data, areas, projects, new Set(data.resources.map((r) => r.id)));
  return data;
}
export async function importBackup(raw: unknown) {
  const data = validateBackup(raw);
  // Decodificação e hash ficam fora da transação: falhas não alteram os dados atuais.
  const covers = await Promise.all(
    data.covers.map(async (c) => {
      const asset = await prepareCoverAsset(
        new Blob([Uint8Array.from(base64ToBytes(c.data)).buffer], { type: c.mime }),
      );
      if (asset.id !== c.id || asset.width !== c.width || asset.height !== c.height)
        throw new Error('A integridade da imagem do backup não confere. Nenhum dado foi alterado.');
      return asset;
    }),
  );
  await db.transaction('rw', tables(), async () => {
    for (const table of tables()) if (table !== db.settings) await table.clear();
    await db.areas.bulkAdd(data.areas);
    await db.projects.bulkAdd(data.projects);
    await db.tasks.bulkAdd(data.tasks);
    await db.resources.bulkAdd(
      data.resources.map((r) => ({
        ...bookDefaults,
        ...r,
        isbnNormalized: normalizeIsbn(r.isbn ?? ''),
      })),
    );
    await db.covers.bulkAdd(covers);
    await db.learningPaths.bulkAdd(data.learningPaths);
    await db.learningStages.bulkAdd(data.learningStages);
    await db.learningTopics.bulkAdd(data.learningTopics);
    await db.learningDependencies.bulkAdd(data.learningDependencies);
    await db.learningStageResources.bulkAdd(data.learningStageResources);
    await db.learningStageTasks.bulkAdd(data.learningStageTasks);
    await db.learningCriteria.bulkAdd(data.learningCriteria);
    await db.competencies.bulkAdd(data.competencies);
    await db.activities.bulkAdd(data.activities);
    await db.settings.put({ key: 'initialized', value: 'true' });
  });
}
export async function removeExamples() {
  await db.transaction('rw', tables(), async () => {
    for (const p of await db.learningPaths.toArray()) if (p.example) await removePathRecords(p.id);
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
