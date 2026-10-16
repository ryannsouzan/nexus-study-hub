import { beforeEach, describe, it, expect } from 'vitest';
import Dexie from 'dexie';
import { db, NexusDatabase } from '../services/db';
import {
  savePath,
  saveStage,
  reorderStages,
  setStageStatus,
  addDependency,
  deleteDependency,
  deleteStage,
  deletePath,
  saveTopic,
  deleteTopic,
  saveCriterion,
  deleteCriterion,
  linkStageTask,
  createStageTask,
  unlinkStageTask,
  linkStageResource,
} from '../services/learning';
import {
  saveTask,
  saveResource,
  deleteEntity,
  exportBackup,
  importBackup,
  validateBackup,
  saveArea,
  saveProject,
} from '../services/repository';
import { learningSnapshot } from '../services/learningState';
import { stageProgress, pathProgress, unmetPrerequisites } from '../domain/learning';
import type { PathInput, StageInput } from '../models/learning';
const path: PathInput = {
  title: 'Aprender Design of Experiments',
  description: '',
  objective: 'Planejar experimentos',
  areaId: '',
  projectId: '',
  status: 'active',
  priority: 'high',
  targetDate: '',
};
const stage = (learningPathId: string, title = 'Estatística'): StageInput => ({
  learningPathId,
  title,
  description: '',
  learningObjectives: ['Interpretar os resultados'],
});
const task = {
  title: 'Exercícios',
  description: '',
  projectId: '',
  status: 'pendente' as const,
  priority: 'media' as const,
  deadline: '',
};
async function criterion(stageId: string) {
  return saveCriterion({
    stageId,
    title: 'Avaliação prática',
    type: 'manual',
    targetId: '',
    required: true,
    checked: false,
    evidence: '',
  });
}
async function complete(stageId: string) {
  const c = await criterion(stageId);
  await saveCriterion({ ...(await db.learningCriteria.get(c))!, checked: true }, c);
  await setStageStatus(stageId, 'completed');
}
beforeEach(async () => {
  await db.transaction('rw', db.tables, async () => {
    await Promise.all(db.tables.map((t) => t.clear()));
  });
});
describe('Trilhas, etapas e DAG', () => {
  it('cria/edita trilhas com área/projeto e impede conclusão vazia', async () => {
    const a = await saveArea({ name: 'Área', description: '', icon: 'flask', color: '#436b55' });
    const projectId = await saveProject({
      name: 'Projeto',
      areaId: a,
      description: '',
      objective: '',
      status: 'andamento',
      priority: 'alta',
      startDate: '',
      deadline: '',
    });
    const p = await savePath({ ...path, areaId: a, projectId });
    await savePath({ ...path, areaId: a, projectId, title: 'DoE', status: 'paused' }, p);
    expect(await db.learningPaths.get(p)).toMatchObject({
      areaId: a,
      projectId,
      title: 'DoE',
      status: 'paused',
    });
    await expect(savePath({ ...path, status: 'completed' }, p)).rejects.toThrow('todas as etapas');
    await expect(savePath({ ...path, areaId: 'missing' })).rejects.toThrow();
  });
  it('ordena etapas sem alterar dependências e exclui dependências incidentes', async () => {
    const p = await savePath(path);
    const a = await saveStage(stage(p, 'A'));
    const b = await saveStage(stage(p, 'B'));
    const d = await addDependency(a, b);
    await reorderStages(p, [b, a]);
    expect((await db.learningStages.get(b))?.position).toBe(0);
    expect(await db.learningDependencies.get(d)).toMatchObject({
      prerequisiteStageId: a,
      dependentStageId: b,
    });
    await expect(reorderStages(p, [a, a])).rejects.toThrow();
    await deleteStage(a);
    expect(await db.learningDependencies.count()).toBe(0);
    expect((await db.learningStages.get(b))?.position).toBe(0);
  });
  it('rejeita auto-dependência, duplicação, ciclos longos e vínculos entre trilhas', async () => {
    const p = await savePath(path);
    const q = await savePath({ ...path, title: 'Outra' });
    const a = await saveStage(stage(p, 'A')),
      b = await saveStage(stage(p, 'B')),
      c = await saveStage(stage(p, 'C')),
      other = await saveStage(stage(q));
    await expect(addDependency(a, a)).rejects.toThrow('si mesma');
    await addDependency(a, b);
    await addDependency(b, c);
    await expect(addDependency(c, a)).rejects.toThrow('circular');
    await expect(addDependency(a, b)).rejects.toThrow('já');
    await expect(addDependency(other, a)).rejects.toThrow('mesma trilha');
    expect(await db.learningDependencies.count()).toBe(2);
  });
  it('bloqueia e desbloqueia com pré-requisitos múltiplos; reabrir propaga invalidação', async () => {
    const p = await savePath(path);
    const a = await saveStage(stage(p, 'A')),
      b = await saveStage(stage(p, 'B')),
      c = await saveStage(stage(p, 'C'));
    await addDependency(a, c);
    await addDependency(b, c);
    await expect(setStageStatus(c, 'completed')).rejects.toThrow('bloqueada');
    await complete(a);
    expect(unmetPrerequisites(c, await learningSnapshot())).toHaveLength(1);
    await complete(b);
    expect(unmetPrerequisites(c, await learningSnapshot())).toHaveLength(0);
    await complete(c);
    await savePath({ ...path, status: 'completed' }, p);
    await setStageStatus(a, 'in_progress');
    expect((await db.learningStages.get(c))?.status).toBe('in_progress');
    expect((await db.learningPaths.get(p))?.status).toBe('active');
    const d = (await db.learningDependencies.toArray())[0];
    await deleteDependency(d.id);
    expect(await db.learningDependencies.count()).toBe(1);
  });
  it('não inventa progresso e pondera por peso ou esforço com cobertura explícita', async () => {
    const p = await savePath(path);
    const a = await saveStage({ ...stage(p, 'A'), weight: 3 }),
      b = await saveStage({ ...stage(p, 'B'), estimatedHours: 1 });
    await saveStage(stage(p, 'Sem critérios'));
    expect(stageProgress(a, await learningSnapshot())).toBeNull();
    expect(pathProgress(p, await learningSnapshot()).value).toBeNull();
    await complete(a);
    await criterion(b);
    expect(pathProgress(p, await learningSnapshot())).toEqual({ value: 75, measured: 2, total: 3 });
    await expect(setStageStatus(b, 'completed')).rejects.toThrow('critérios');
  });
});
describe('Critérios, tópicos e associações existentes', () => {
  it('usa a mesma tarefa, atualiza progresso e invalida conclusão quando reaberta', async () => {
    const p = await savePath(path),
      s = await saveStage(stage(p));
    const t = await createStageTask(s, task);
    expect(await db.tasks.count()).toBe(1);
    await saveCriterion({
      stageId: s,
      title: 'Resolver exercícios',
      type: 'task',
      targetId: t,
      required: true,
      checked: false,
      evidence: '',
    });
    expect(stageProgress(s, await learningSnapshot())).toBe(0);
    await saveTask({ ...task, status: 'concluida' }, t);
    expect(stageProgress(s, await learningSnapshot())).toBe(100);
    expect((await db.learningStages.get(s))?.status).toBe('not_started');
    await setStageStatus(s, 'completed');
    await saveTask(task, t);
    expect((await db.learningStages.get(s))?.status).toBe('in_progress');
    const link = (await db.learningStageTasks.toArray())[0];
    await unlinkStageTask(link.id);
    expect(await db.tasks.get(t)).toBeDefined();
    expect(stageProgress(s, await learningSnapshot())).toBeNull();
  });
  it('tópico dominado é autoavaliação, evidência exige texto; critérios opcionais ficam fora', async () => {
    const p = await savePath(path),
      s = await saveStage(stage(p));
    const topic = await saveTopic({
      stageId: s,
      title: 'ANOVA',
      description: '',
      status: 'studying',
    });
    await saveCriterion({
      stageId: s,
      title: 'Autoavaliar ANOVA',
      type: 'topic',
      targetId: topic,
      required: true,
      checked: false,
      evidence: '',
    });
    const evidence = await saveCriterion({
      stageId: s,
      title: 'Experimento',
      type: 'evidence',
      targetId: '',
      required: true,
      checked: false,
      evidence: '',
    });
    await saveCriterion({
      stageId: s,
      title: 'Opcional',
      type: 'manual',
      targetId: '',
      required: false,
      checked: false,
      evidence: '',
    });
    await saveTopic({ ...(await db.learningTopics.get(topic))!, status: 'mastered' }, topic);
    expect(stageProgress(s, await learningSnapshot())).toBe(50);
    await saveCriterion(
      {
        ...(await db.learningCriteria.get(evidence))!,
        evidence: 'Analisei o experimento e registrei a interpretação.',
      },
      evidence,
    );
    expect(stageProgress(s, await learningSnapshot())).toBe(100);
    await setStageStatus(s, 'completed');
    await deleteTopic(topic);
    await deleteCriterion(evidence);
    expect(stageProgress(s, await learningSnapshot())).toBeNull();
    expect((await db.learningStages.get(s))?.status).toBe('in_progress');
  });
  it('preserva tarefa/recurso independentes ao excluir etapa ou trilha', async () => {
    const p = await savePath(path),
      s = await saveStage(stage(p));
    const t = await saveTask(task);
    await linkStageTask(s, t);
    await expect(linkStageTask(s, t)).rejects.toThrow();
    const r = await saveResource({
      title: 'Livro',
      author: '',
      type: 'livro',
      description: '',
      url: '',
      areaId: '',
      projectIds: [],
      tags: [],
      status: 'desejo',
      totalPages: 0,
      currentPage: 0,
      doi: '',
      journal: '',
      year: 0,
      platform: '',
      totalLessons: 0,
      completedLessons: 0,
    });
    await linkStageResource(s, r);
    await expect(linkStageResource(s, r)).rejects.toThrow();
    await deletePath(p);
    expect(await db.tasks.get(t)).toBeDefined();
    expect(await db.resources.get(r)).toBeDefined();
    for (const table of [db.learningStages, db.learningStageTasks, db.learningStageResources])
      expect(await table.count()).toBe(0);
  });
  it('exclusões externas removem associações e preservam etapas; tarefas órfãs não são critérios válidos', async () => {
    const p = await savePath(path),
      s = await saveStage(stage(p)),
      t = await saveTask(task);
    await expect(
      saveCriterion({
        stageId: s,
        title: 'Tarefa',
        type: 'task',
        targetId: t,
        required: true,
        checked: false,
        evidence: '',
      }),
    ).rejects.toThrow('Vincule');
    await linkStageTask(s, t);
    await saveCriterion({
      stageId: s,
      title: 'Tarefa',
      type: 'task',
      targetId: t,
      required: true,
      checked: false,
      evidence: '',
    });
    await deleteEntity('task', t);
    expect(await db.learningStageTasks.count()).toBe(0);
    expect(await db.learningCriteria.count()).toBe(0);
    expect(await db.learningStages.get(s)).toBeDefined();
  });
});
describe('Backup e migração', () => {
  it('restaura dependências, critérios, tópicos e IDs, rejeitando ciclos sem alterar registros', async () => {
    const p = await savePath(path),
      a = await saveStage(stage(p, 'A')),
      b = await saveStage(stage(p, 'B'));
    await addDependency(a, b);
    await criterion(a);
    const backup = await exportBackup();
    expect(backup.schemaVersion).toBe(3);
    await deletePath(p);
    await importBackup(JSON.parse(JSON.stringify(backup)));
    expect(await db.learningStages.count()).toBe(2);
    const bad = {
      ...backup,
      learningDependencies: [
        ...backup.learningDependencies,
        {
          id: crypto.randomUUID(),
          learningPathId: p,
          prerequisiteStageId: b,
          dependentStageId: a,
          createdAt: new Date().toISOString(),
        },
      ],
    };
    expect(() => validateBackup(bad)).toThrow('circular');
    await expect(importBackup(bad)).rejects.toThrow();
    expect(await db.learningStages.count()).toBe(2);
    db.close();
    await db.open();
    expect(await db.learningCriteria.count()).toBe(1);
    const invalid = {
      ...backup,
      learningStages: [{ ...backup.learningStages[0], learningPathId: crypto.randomUUID() }],
    };
    expect(() => validateBackup(invalid)).toThrow();
  });
  it('aceita backup v2 com capas sem exigir trilhas e migra DB v2 sem perda', async () => {
    const backup = await exportBackup();
    await importBackup({ ...backup, schemaVersion: 2 });
    expect(await db.learningPaths.count()).toBe(0);
    const name = `learning-v2-${crypto.randomUUID()}`;
    const old = new Dexie(name);
    old.version(2).stores({ resources: 'id, coverId', covers: 'id', settings: 'key' });
    await old.table('resources').put({
      id: 'legacy',
      title: 'Livro anterior',
      currentPage: 150,
      totalPages: 500,
      coverId: 'cover',
    });
    await old.table('covers').put({ id: 'cover', blob: new Blob(['preservar']) });
    old.close();
    const migrated = new NexusDatabase(name);
    try {
      await migrated.open();
      expect(migrated.verno).toBe(3);
      expect(await migrated.resources.get('legacy')).toMatchObject({
        currentPage: 150,
        coverId: 'cover',
      });
      expect(await migrated.covers.get('cover')).toBeDefined();
      expect(await migrated.learningPaths.count()).toBe(0);
    } finally {
      await migrated.delete();
    }
  });
});
