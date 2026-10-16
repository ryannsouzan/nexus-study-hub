import { db } from './db';
import {
  pathInputSchema,
  stageInputSchema,
  topicInputSchema,
  criterionInputSchema,
  type PathInput,
  type StageInput,
  type TopicInput,
  type CriterionInput,
  type LearningStage,
  type LearningDependency,
} from '../models/learning';
import {
  assertAcyclic,
  orderedStages,
  stageProgress,
  unmetPrerequisites,
} from '../domain/learning';
import {
  learningSnapshot,
  reconcileLearningState,
  removeStageRecords,
  removePathRecords,
} from './learningState';
import { saveTask } from './repository';
import type { TaskInput } from '../models/schema';
const transaction = <T>(fn: () => Promise<T>) => db.transaction('rw', db.tables, fn);
const meta = () => {
  const now = new Date().toISOString();
  return { id: crypto.randomUUID(), createdAt: now, updatedAt: now };
};
async function pathExists(id: string) {
  if (!(await db.learningPaths.get(id))) throw new Error('Trilha não encontrada.');
}
async function stageExists(id: string) {
  const s = await db.learningStages.get(id);
  if (!s) throw new Error('Etapa não encontrada.');
  return s;
}
async function touch(stageId: string) {
  const s = await stageExists(stageId);
  await db.learningStages.update(stageId, { updatedAt: new Date().toISOString() });
  await db.learningPaths.update(s.learningPathId, { updatedAt: new Date().toISOString() });
}
export async function savePath(input: PathInput, id?: string) {
  const data = pathInputSchema.parse(input);
  return transaction(async () => {
    if (data.areaId && !(await db.areas.get(data.areaId))) throw new Error('Área não encontrada.');
    if (data.projectId && !(await db.projects.get(data.projectId)))
      throw new Error('Projeto não encontrado.');
    const old = id ? await db.learningPaths.get(id) : undefined;
    if (id && !old) throw new Error('Trilha não encontrada.');
    const key = old?.id ?? crypto.randomUUID();
    if (data.status === 'completed') {
      const stages = await db.learningStages.where('learningPathId').equals(key).toArray();
      if (!stages.length || stages.some((s) => s.status !== 'completed'))
        throw new Error('Conclua todas as etapas antes de concluir a trilha.');
    }
    await db.learningPaths.put({
      ...meta(),
      ...old,
      ...data,
      id: key,
      example: old?.example ?? false,
      updatedAt: new Date().toISOString(),
      completedAt:
        data.status === 'completed' ? (old?.completedAt ?? new Date().toISOString()) : null,
    });
    return key;
  });
}
export async function saveStage(input: StageInput, id?: string) {
  const data = stageInputSchema.parse(input);
  return transaction(async () => {
    await pathExists(data.learningPathId);
    const old = id ? await db.learningStages.get(id) : undefined;
    if (id && (!old || old.learningPathId !== data.learningPathId))
      throw new Error('Etapa não encontrada nesta trilha.');
    const positions = await db.learningStages
      .where('learningPathId')
      .equals(data.learningPathId)
      .toArray();
    const record = {
      ...meta(),
      ...old,
      ...data,
      position: old?.position ?? Math.max(-1, ...positions.map((s) => s.position)) + 1,
      status: old?.status ?? ('not_started' as const),
      completedAt: old?.completedAt ?? null,
      updatedAt: new Date().toISOString(),
    };
    await db.learningStages.put(record);
    await touch(record.id);
    await reconcileLearningState();
    return record.id;
  });
}
export async function reorderStages(pathId: string, ids: string[]) {
  return transaction(async () => {
    await pathExists(pathId);
    const stages = await db.learningStages.where('learningPathId').equals(pathId).toArray();
    if (
      ids.length !== stages.length ||
      new Set(ids).size !== ids.length ||
      stages.some((s) => !ids.includes(s.id))
    )
      throw new Error('A ordem deve conter cada etapa desta trilha uma única vez.');
    for (let i = 0; i < ids.length; i++)
      await db.learningStages.update(ids[i], { position: i, updatedAt: new Date().toISOString() });
    await db.learningPaths.update(pathId, { updatedAt: new Date().toISOString() });
  });
}
export async function setStageStatus(id: string, status: LearningStage['status']) {
  if (!['not_started', 'in_progress', 'completed'].includes(status))
    throw new Error('Status inválido.');
  return transaction(async () => {
    await stageExists(id);
    const data = await learningSnapshot();
    if (status === 'completed') {
      if (unmetPrerequisites(id, data).length)
        throw new Error('Etapa bloqueada: conclua os pré-requisitos primeiro.');
      if (stageProgress(id, data) !== 100)
        throw new Error(
          'Defina e atenda todos os critérios obrigatórios antes de concluir a etapa.',
        );
    }
    await db.learningStages.update(id, {
      status,
      completedAt: status === 'completed' ? new Date().toISOString() : null,
    });
    await touch(id);
    await reconcileLearningState();
  });
}
export async function addDependency(prerequisiteStageId: string, dependentStageId: string) {
  return transaction(async () => {
    const a = await stageExists(prerequisiteStageId);
    const b = await stageExists(dependentStageId);
    const record: LearningDependency = {
      id: crypto.randomUUID(),
      learningPathId: b.learningPathId,
      prerequisiteStageId: a.id,
      dependentStageId: b.id,
      createdAt: new Date().toISOString(),
    };
    assertAcyclic(await db.learningStages.toArray(), [
      ...(await db.learningDependencies.toArray()),
      record,
    ]);
    await db.learningDependencies.add(record);
    await touch(b.id);
    await reconcileLearningState();
    return record.id;
  });
}
export async function deleteDependency(id: string) {
  return transaction(async () => {
    const d = await db.learningDependencies.get(id);
    if (!d) throw new Error('Dependência não encontrada.');
    await db.learningDependencies.delete(id);
    await touch(d.dependentStageId);
    await reconcileLearningState();
  });
}
export async function deleteStage(id: string) {
  return transaction(async () => {
    const s = await stageExists(id);
    await removeStageRecords(id);
    const remaining = orderedStages(s.learningPathId, await learningSnapshot());
    for (let i = 0; i < remaining.length; i++)
      await db.learningStages.update(remaining[i].id, { position: i });
    await db.learningPaths.update(s.learningPathId, { updatedAt: new Date().toISOString() });
    await reconcileLearningState();
  });
}
export async function deletePath(id: string) {
  return transaction(async () => {
    await pathExists(id);
    await removePathRecords(id);
  });
}
export async function saveTopic(input: TopicInput, id?: string) {
  const data = topicInputSchema.parse(input);
  return transaction(async () => {
    await stageExists(data.stageId);
    const old = id ? await db.learningTopics.get(id) : undefined;
    if (id && (!old || old.stageId !== data.stageId))
      throw new Error('Tópico não encontrado nesta etapa.');
    const record = { ...meta(), ...old, ...data, updatedAt: new Date().toISOString() };
    await db.learningTopics.put(record);
    await touch(data.stageId);
    await reconcileLearningState();
    return record.id;
  });
}
export async function deleteTopic(id: string) {
  return transaction(async () => {
    const t = await db.learningTopics.get(id);
    if (!t) throw new Error('Tópico não encontrado.');
    await db.learningCriteria.where('[type+targetId]').equals(['topic', id]).delete();
    await db.learningTopics.delete(id);
    await touch(t.stageId);
    await reconcileLearningState();
  });
}
export async function saveCriterion(input: CriterionInput, id?: string) {
  const data = criterionInputSchema.parse(input);
  return transaction(async () => {
    await stageExists(data.stageId);
    const old = id ? await db.learningCriteria.get(id) : undefined;
    if (id && (!old || old.stageId !== data.stageId))
      throw new Error('Critério não encontrado nesta etapa.');
    if (
      data.type === 'task' &&
      !(await db.learningStageTasks
        .where('[stageId+taskId]')
        .equals([data.stageId, data.targetId])
        .count())
    )
      throw new Error('Vincule a tarefa a esta etapa antes de usá-la como critério.');
    if (
      data.type === 'topic' &&
      (await db.learningTopics.get(data.targetId))?.stageId !== data.stageId
    )
      throw new Error('O tópico deve pertencer a esta etapa.');
    const record = { ...meta(), ...old, ...data, updatedAt: new Date().toISOString() };
    await db.learningCriteria.put(record);
    await touch(data.stageId);
    await reconcileLearningState();
    return record.id;
  });
}
export async function deleteCriterion(id: string) {
  return transaction(async () => {
    const c = await db.learningCriteria.get(id);
    if (!c) throw new Error('Critério não encontrado.');
    await db.learningCriteria.delete(id);
    await touch(c.stageId);
    await reconcileLearningState();
  });
}
export async function linkStageTask(stageId: string, taskId: string) {
  return transaction(async () => {
    await stageExists(stageId);
    if (!(await db.tasks.get(taskId))) throw new Error('Tarefa não encontrada.');
    if (await db.learningStageTasks.where('[stageId+taskId]').equals([stageId, taskId]).count())
      throw new Error('Esta tarefa já está vinculada à etapa.');
    await db.learningStageTasks.add({ id: crypto.randomUUID(), stageId, taskId });
    await touch(stageId);
  });
}
export async function createStageTask(stageId: string, input: TaskInput) {
  return transaction(async () => {
    await stageExists(stageId);
    const id = await saveTask(input);
    await linkStageTask(stageId, id);
    return id;
  });
}
export async function unlinkStageTask(id: string) {
  return transaction(async () => {
    const link = await db.learningStageTasks.get(id);
    if (!link) throw new Error('Associação não encontrada.');
    await db.learningCriteria
      .where('[type+targetId]')
      .equals(['task', link.taskId])
      .filter((c) => c.stageId === link.stageId)
      .delete();
    await db.learningStageTasks.delete(id);
    await touch(link.stageId);
    await reconcileLearningState();
  });
}
export async function linkStageResource(stageId: string, resourceId: string) {
  return transaction(async () => {
    await stageExists(stageId);
    if (!(await db.resources.get(resourceId))) throw new Error('Recurso não encontrado.');
    if (
      await db.learningStageResources
        .where('[stageId+resourceId]')
        .equals([stageId, resourceId])
        .count()
    )
      throw new Error('Este recurso já está vinculado à etapa.');
    await db.learningStageResources.add({ id: crypto.randomUUID(), stageId, resourceId });
    await touch(stageId);
  });
}
export async function unlinkStageResource(id: string) {
  return transaction(async () => {
    const link = await db.learningStageResources.get(id);
    if (!link) throw new Error('Associação não encontrada.');
    await db.learningStageResources.delete(id);
    await touch(link.stageId);
  });
}
