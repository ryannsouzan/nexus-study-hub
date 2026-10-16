import { db } from './db';
import { stageProgress, unmetPrerequisites } from '../domain/learning';
export async function learningSnapshot() {
  return {
    learningPaths: await db.learningPaths.toArray(),
    learningStages: await db.learningStages.toArray(),
    learningTopics: await db.learningTopics.toArray(),
    learningDependencies: await db.learningDependencies.toArray(),
    learningStageResources: await db.learningStageResources.toArray(),
    learningStageTasks: await db.learningStageTasks.toArray(),
    learningCriteria: await db.learningCriteria.toArray(),
    tasks: await db.tasks.toArray(),
  };
}
// Chamado dentro da transação que modificou critérios, tarefas ou dependências.
export async function reconcileLearningState() {
  const data = await learningSnapshot();
  let changed = true;
  const now = new Date().toISOString();
  while (changed) {
    changed = false;
    for (const s of data.learningStages)
      if (
        s.status === 'completed' &&
        (stageProgress(s.id, data) !== 100 || unmetPrerequisites(s.id, data).length)
      ) {
        s.status = 'in_progress';
        s.completedAt = null;
        s.updatedAt = now;
        await db.learningStages.put(s);
        changed = true;
      }
  }
  for (const p of data.learningPaths)
    if (
      p.status === 'completed' &&
      (!data.learningStages.some((s) => s.learningPathId === p.id) ||
        data.learningStages.some((s) => s.learningPathId === p.id && s.status !== 'completed'))
    )
      await db.learningPaths.update(p.id, { status: 'active', completedAt: null, updatedAt: now });
}
export async function removeStageRecords(id: string) {
  await db.learningDependencies
    .toCollection()
    .filter((d) => d.prerequisiteStageId === id || d.dependentStageId === id)
    .delete();
  await db.learningTopics.where('stageId').equals(id).delete();
  await db.learningCriteria.where('stageId').equals(id).delete();
  await db.learningStageResources.where('stageId').equals(id).delete();
  await db.learningStageTasks.where('stageId').equals(id).delete();
  await db.learningStages.delete(id);
}
export async function removePathRecords(id: string) {
  for (const s of await db.learningStages.where('learningPathId').equals(id).toArray())
    await removeStageRecords(s.id);
  await db.learningPaths.delete(id);
}
