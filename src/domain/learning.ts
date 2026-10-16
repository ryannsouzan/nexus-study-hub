import type {
  LearningData,
  LearningStage,
  LearningDependency,
  LearningCriterion,
} from '../models/learning';
import type { Task } from '../models/schema';
export type LearningSnapshot = LearningData & { tasks: Task[] };
export function assertAcyclic(stages: LearningStage[], dependencies: LearningDependency[]) {
  const map = new Map(stages.map((s) => [s.id, s]));
  const outgoing = new Map<string, string[]>();
  const incoming = new Map(stages.map((s) => [s.id, 0]));
  const pairs = new Set<string>();
  for (const d of dependencies) {
    const a = map.get(d.prerequisiteStageId);
    const b = map.get(d.dependentStageId);
    if (!a || !b || a.learningPathId !== d.learningPathId || b.learningPathId !== d.learningPathId)
      throw new Error('Pré-requisitos devem pertencer à mesma trilha.');
    if (a.id === b.id) throw new Error('Uma etapa não pode depender de si mesma.');
    const key = `${a.id}:${b.id}`;
    if (pairs.has(key)) throw new Error('Este pré-requisito já foi adicionado.');
    pairs.add(key);
    outgoing.set(a.id, [...(outgoing.get(a.id) ?? []), b.id]);
    incoming.set(b.id, incoming.get(b.id)! + 1);
  }
  const queue = stages.filter((s) => incoming.get(s.id) === 0).map((s) => s.id);
  let visited = 0;
  for (let i = 0; i < queue.length; i++) {
    const id = queue[i];
    visited++;
    for (const next of outgoing.get(id) ?? []) {
      incoming.set(next, incoming.get(next)! - 1);
      if (incoming.get(next) === 0) queue.push(next);
    }
  }
  if (visited !== stages.length)
    throw new Error('Esse pré-requisito criaria uma dependência circular.');
}
export function unmetPrerequisites(stageId: string, data: LearningData) {
  return data.learningDependencies
    .filter((d) => d.dependentStageId === stageId)
    .map((d) => data.learningStages.find((s) => s.id === d.prerequisiteStageId)!)
    .filter((s) => !s || s.status !== 'completed');
}
export function criterionMet(c: LearningCriterion, data: LearningSnapshot) {
  if (c.type === 'task')
    return data.tasks.some((t) => t.id === c.targetId && t.status === 'concluida');
  if (c.type === 'topic')
    return data.learningTopics.some((t) => t.id === c.targetId && t.status === 'mastered');
  if (c.type === 'evidence') return !!c.evidence.trim();
  return c.checked;
}
export function stageProgress(stageId: string, data: LearningSnapshot) {
  const criteria = data.learningCriteria.filter((c) => c.stageId === stageId && c.required);
  if (!criteria.length) return null;
  return Math.round((criteria.filter((c) => criterionMet(c, data)).length / criteria.length) * 100);
}
export function pathProgress(pathId: string, data: LearningSnapshot) {
  const stages = data.learningStages.filter((s) => s.learningPathId === pathId);
  let weighted = 0,
    totalWeight = 0,
    measured = 0;
  for (const stage of stages) {
    const criteria = data.learningCriteria.filter((c) => c.stageId === stage.id && c.required);
    if (!criteria.length) continue;
    const weight = stage.weight ?? stage.estimatedHours ?? 1;
    weighted += (criteria.filter((c) => criterionMet(c, data)).length / criteria.length) * weight;
    totalWeight += weight;
    measured++;
  }
  return {
    value: totalWeight ? Math.round((weighted / totalWeight) * 100) : null,
    measured,
    total: stages.length,
  };
}
export const progressMethod =
  'Média das etapas mensuráveis: peso configurado, ou horas estimadas, ou peso 1. Etapas sem critérios obrigatórios ficam fora da média. Conclusão exige todas as etapas concluídas.';
export function orderedStages(pathId: string, data: LearningData) {
  return data.learningStages
    .filter((s) => s.learningPathId === pathId)
    .sort((a, b) => a.position - b.position || a.id.localeCompare(b.id));
}
export function nextStages(pathId: string, data: LearningData) {
  return orderedStages(pathId, data).filter(
    (s) => s.status !== 'completed' && unmetPrerequisites(s.id, data).length === 0,
  );
}
export function validateLearningData(
  data: LearningSnapshot,
  areas: Set<string>,
  projects: Set<string>,
  resources: Set<string>,
) {
  const paths = new Set(data.learningPaths.map((p) => p.id)),
    stages = new Set(data.learningStages.map((s) => s.id)),
    tasks = new Set(data.tasks.map((t) => t.id));
  if (
    data.learningPaths.some(
      (p) => (p.areaId && !areas.has(p.areaId)) || (p.projectId && !projects.has(p.projectId)),
    ) ||
    data.learningStages.some((s) => !paths.has(s.learningPathId)) ||
    data.learningTopics.some((t) => !stages.has(t.stageId)) ||
    data.learningStageResources.some(
      (r) => !stages.has(r.stageId) || !resources.has(r.resourceId),
    ) ||
    data.learningStageTasks.some((t) => !stages.has(t.stageId) || !tasks.has(t.taskId))
  )
    throw new Error('O backup contém referências inválidas nas trilhas.');
  for (const links of [
    data.learningStageResources.map((r) => `${r.stageId}:${r.resourceId}`),
    data.learningStageTasks.map((t) => `${t.stageId}:${t.taskId}`),
  ])
    if (new Set(links).size !== links.length)
      throw new Error('O backup contém associações duplicadas nas etapas.');
  for (const c of data.learningCriteria) {
    if (
      !stages.has(c.stageId) ||
      (c.type === 'task' &&
        !data.learningStageTasks.some((t) => t.stageId === c.stageId && t.taskId === c.targetId)) ||
      (c.type === 'topic' &&
        !data.learningTopics.some((t) => t.stageId === c.stageId && t.id === c.targetId))
    )
      throw new Error('O backup contém critérios com referências inválidas.');
  }
  assertAcyclic(data.learningStages, data.learningDependencies);
  for (const p of data.learningPaths) {
    const positions = orderedStages(p.id, data).map((s) => s.position);
    if (new Set(positions).size !== positions.length)
      throw new Error('O backup contém posições duplicadas nas etapas.');
    if (
      p.status === 'completed' &&
      (!positions.length || orderedStages(p.id, data).some((s) => s.status !== 'completed'))
    )
      throw new Error('A conclusão de uma trilha é inconsistente.');
  }
  if (
    data.learningStages.some(
      (s) =>
        s.status === 'completed' &&
        (stageProgress(s.id, data) !== 100 || unmetPrerequisites(s.id, data).length),
    )
  )
    throw new Error('O backup contém etapas concluídas com critérios ou pré-requisitos pendentes.');
}
