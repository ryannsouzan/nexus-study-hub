import { beforeEach, describe, it, expect } from 'vitest';
import { db } from '../services/db';
import {
  saveArea,
  saveProject,
  saveTask,
  saveResource,
  deleteEntity,
  exportBackup,
  importBackup,
  validateBackup,
  removeExamples,
} from '../services/repository';
import {
  projectProgress,
  resourceProgress,
  filterTasks,
  sortTasks,
  localDate,
  dashboardMetrics,
  matches,
} from '../services/calculations';
import { initializeDatabase } from '../services/seed';
import type { AreaInput, ProjectInput, TaskInput, ResourceInput, Task } from '../models/schema';
const area: AreaInput = {
  name: 'Desenvolvimento Analítico',
  description: 'Métodos e estudos',
  color: '#628d74',
  icon: 'flask',
};
const project: ProjectInput = {
  name: 'Aprender DoE',
  description: '',
  objective: 'Planejar experimentos',
  areaId: '',
  status: 'andamento',
  priority: 'alta',
  startDate: '',
  deadline: '',
};
const task: TaskInput = {
  title: 'Estudar experimentos',
  description: '',
  projectId: '',
  status: 'pendente',
  priority: 'media',
  deadline: '',
};
const resource: ResourceInput = {
  title: 'Livro de estatística',
  author: '',
  type: 'livro',
  description: '',
  url: '',
  areaId: '',
  projectIds: [],
  tags: [],
  status: 'andamento',
  totalPages: 500,
  currentPage: 150,
  doi: '',
  journal: '',
  year: 0,
  platform: '',
  totalLessons: 0,
  completedLessons: 0,
};
beforeEach(async () => {
  await db.transaction(
    'rw',
    [
      db.areas,
      db.projects,
      db.tasks,
      db.resources,
      db.competencies,
      db.activities,
      db.settings,
      db.covers,
    ],
    async () => {
      await Promise.all(db.tables.map((t) => t.clear()));
    },
  );
});
describe('Áreas, projetos e tarefas', () => {
  it('cria e edita uma área; valida campos', async () => {
    const id = await saveArea(area);
    expect((await db.areas.get(id))?.name).toBe(area.name);
    await saveArea({ ...area, name: 'Analítica' }, id);
    expect((await db.areas.get(id))?.name).toBe('Analítica');
    await expect(saveArea({ ...area, name: ' ' })).rejects.toThrow();
  });
  it('cria e edita projeto com vínculo a uma área existente', async () => {
    const a = await saveArea(area);
    const p = await saveProject({ ...project, areaId: a });
    await saveProject({ ...project, areaId: a, name: 'Aplicar DoE', status: 'pausado' }, p);
    expect(await db.projects.get(p)).toMatchObject({
      areaId: a,
      status: 'pausado',
      name: 'Aplicar DoE',
    });
    await expect(saveProject({ ...project, areaId: 'inexistente' })).rejects.toThrow();
    await expect(
      saveProject({ ...project, startDate: '2026-10-10', deadline: '2026-10-09' }),
    ).rejects.toThrow();
  });
  it('completa o fluxo de cinco tarefas e duas conclusões com 40% e reabertura', async () => {
    const a = await saveArea(area);
    const p = await saveProject({ ...project, areaId: a });
    const ids = [];
    for (let i = 0; i < 5; i++)
      ids.push(await saveTask({ ...task, title: `Tarefa ${i}`, projectId: p }));
    for (const id of ids.slice(0, 2)) {
      const t = (await db.tasks.get(id))!;
      await saveTask({ ...t, status: 'concluida' }, id);
    }
    expect(projectProgress(p, await db.tasks.toArray())).toBe(40);
    expect((await db.tasks.get(ids[0]))?.completedAt).not.toBeNull();
    await saveTask({ ...task, projectId: p }, ids[0]);
    expect((await db.tasks.get(ids[0]))?.completedAt).toBeNull();
    expect(projectProgress(p, await db.tasks.toArray())).toBe(20);
    expect(
      (await db.activities.where('entityId').equals(ids[0]).toArray()).some(
        (a) => a.action === 'reopened',
      ),
    ).toBe(true);
  });
  it('não inventa progresso sem tarefas e ignora canceladas', async () => {
    const p = await saveProject(project);
    expect(projectProgress(p, [])).toBeNull();
    await saveTask({ ...task, projectId: p, status: 'cancelada' });
    expect(projectProgress(p, await db.tasks.toArray())).toBeNull();
    await saveTask({ ...task, projectId: p, status: 'concluida' });
    expect(projectProgress(p, await db.tasks.toArray())).toBe(100);
  });
  it('exclui área preservando projetos, recursos e tarefas', async () => {
    const a = await saveArea(area);
    const p = await saveProject({ ...project, areaId: a });
    const t = await saveTask({ ...task, projectId: p });
    const r = await saveResource({ ...resource, areaId: a, projectIds: [p] });
    await deleteEntity('area', a);
    expect(await db.areas.get(a)).toBeUndefined();
    expect((await db.projects.get(p))?.areaId).toBe('');
    expect((await db.resources.get(r))?.areaId).toBe('');
    expect((await db.tasks.get(t))?.projectId).toBe(p);
  });
  it('exclui projeto preservando e desvinculando tarefas e recursos', async () => {
    const p = await saveProject(project);
    const other = await saveProject({ ...project, name: 'Outro' });
    const t = await saveTask({ ...task, projectId: p });
    const r = await saveResource({ ...resource, projectIds: [p, other] });
    await deleteEntity('project', p);
    expect((await db.tasks.get(t))?.projectId).toBe('');
    expect((await db.resources.get(r))?.projectIds).toEqual([other]);
    await deleteEntity('task', t);
    await deleteEntity('resource', r);
    expect(await db.tasks.get(t)).toBeUndefined();
    expect(await db.resources.get(r)).toBeUndefined();
  });
  it('rejeita tarefas com vínculos inválidos sem escrita parcial', async () => {
    const before = await db.activities.count();
    await expect(saveTask({ ...task, projectId: 'ausente' })).rejects.toThrow();
    expect(await db.tasks.count()).toBe(0);
    expect(await db.activities.count()).toBe(before);
  });
});
describe('Biblioteca e integridade', () => {
  it('calcula progresso de livro (30%) e curso e evita contagens inválidas', async () => {
    const p = await saveProject(project);
    const id = await saveResource({ ...resource, projectIds: [p, p] });
    const r = (await db.resources.get(id))!;
    expect(resourceProgress(r)).toBe(30);
    expect(r.projectIds).toEqual([p]);
    await saveResource({ ...r, currentPage: 200 }, id);
    expect(resourceProgress((await db.resources.get(id))!)).toBe(40);
    expect(
      resourceProgress({ ...resource, type: 'curso', totalLessons: 20, completedLessons: 5 }),
    ).toBe(25);
    expect(resourceProgress({ ...resource, totalPages: 0, currentPage: 0 })).toBeNull();
    await expect(saveResource({ ...resource, currentPage: 501 })).rejects.toThrow();
    await expect(
      saveResource({ ...resource, type: 'curso', totalLessons: 3, completedLessons: 4 }),
    ).rejects.toThrow();
    await expect(saveResource({ ...resource, url: 'javascript:alert(1)' })).rejects.toThrow();
  });
  it('preserva outros vínculos ao remover uma associação', async () => {
    const p = await saveProject(project);
    const q = await saveProject({ ...project, name: 'Segundo' });
    const r = await saveResource({ ...resource, projectIds: [p, q] });
    await saveResource({ ...resource, projectIds: [q] }, r);
    expect((await db.resources.get(r))?.projectIds).toEqual([q]);
    expect(await db.projects.count()).toBe(2);
    await expect(saveResource({ ...resource, projectIds: ['ausente'] })).rejects.toThrow();
  });
  it('remove exemplos preservando dados próprios vinculados; não recria após inicialização', async () => {
    await initializeDatabase();
    const p = await saveProject({ ...project, areaId: 'demo-analitico' });
    const t = await saveTask({ ...task, projectId: 'demo-doe' });
    const r = await saveResource({
      ...resource,
      projectIds: ['demo-doe'],
      areaId: 'demo-analitico',
    });
    await removeExamples();
    expect(await db.projects.get(p)).toMatchObject({ areaId: '', example: false });
    expect(await db.tasks.get(t)).toMatchObject({ projectId: '', example: false });
    expect(await db.resources.get(r)).toMatchObject({ areaId: '', projectIds: [], example: false });
    await initializeDatabase();
    expect(await db.areas.count()).toBe(0);
    expect(await db.projects.count()).toBe(1);
  });
});
describe('Backup transacional', () => {
  it('exporta, restaura IDs e relacionamentos; sobrevive ao fechamento do banco', async () => {
    const a = await saveArea(area);
    const p = await saveProject({ ...project, areaId: a });
    const t = await saveTask({ ...task, projectId: p, status: 'concluida' });
    const r = await saveResource({ ...resource, areaId: a, projectIds: [p] });
    const backup = await exportBackup();
    expect(backup.schemaVersion).toBe(2);
    await deleteEntity('project', p);
    await importBackup(JSON.parse(JSON.stringify(backup)));
    expect((await db.tasks.get(t))?.projectId).toBe(p);
    expect((await db.resources.get(r))?.projectIds).toEqual([p]);
    expect((await db.projects.get(p))?.areaId).toBe(a);
    db.close();
    await db.open();
    expect(await db.tasks.get(t)).toBeDefined();
    expect((await exportBackup()).activities).toEqual(backup.activities);
  });
  it('rejeita versão, estrutura, duplicados e vínculos inválidos sem corromper os dados', async () => {
    const a = await saveArea(area);
    const backup = await exportBackup();
    const invalid = [
      {},
      { ...backup, schemaVersion: 99 },
      { ...backup, areas: [...backup.areas, ...backup.areas] },
      {
        ...backup,
        projects: [
          {
            ...project,
            id: 'x',
            areaId: 'ausente',
            createdAt: backup.exportedAt,
            updatedAt: backup.exportedAt,
            example: false,
          },
        ],
      },
      {
        ...backup,
        tasks: [
          {
            ...task,
            id: 't',
            status: 'concluida',
            completedAt: null,
            createdAt: backup.exportedAt,
            updatedAt: backup.exportedAt,
            example: false,
          },
        ],
      },
    ];
    for (const raw of invalid) {
      expect(() => validateBackup(raw)).toThrow();
      await expect(importBackup(raw)).rejects.toThrow();
      expect(await db.areas.get(a)).toBeDefined();
    }
  });
});
describe('Filtros, datas e dashboard', () => {
  const make = (
    id: string,
    deadline: string,
    status: Task['status'] = 'pendente',
    priority: Task['priority'] = 'media',
  ): Task => ({
    ...task,
    id,
    deadline,
    status,
    priority,
    createdAt: '2026-10-01T12:00:00.000Z',
    updatedAt: '2026-10-01T12:00:00.000Z',
    example: false,
    completedAt: status === 'concluida' ? '2026-10-14T12:00:00.000Z' : null,
  });
  it('filtra hoje, próximos sete dias, atrasadas e concluídas pelas datas locais', () => {
    const tasks = [
      make('a', '2026-10-13'),
      make('b', '2026-10-14'),
      make('c', '2026-10-20'),
      make('d', '2026-10-21'),
      make('e', '', 'concluida'),
      make('f', '2026-10-13', 'cancelada'),
      make('g', ''),
    ];
    expect(filterTasks(tasks, 'hoje', '2026-10-14').map((t) => t.id)).toEqual(['a', 'b']);
    expect(filterTasks(tasks, 'semana', '2026-10-14').map((t) => t.id)).toEqual(['b', 'c']);
    expect(filterTasks(tasks, 'atrasadas', '2026-10-14').map((t) => t.id)).toEqual(['a']);
    expect(filterTasks(tasks, 'concluidas').map((t) => t.id)).toEqual(['e']);
    expect(filterTasks(tasks, 'todas')).toHaveLength(7);
  });
  it('ordena por prazo e prioridade; busca ignora acentos', () => {
    const tasks = [make('a', '', 'pendente', 'alta'), make('b', '2026-10-14', 'pendente', 'baixa')];
    expect(sortTasks(tasks, 'deadline')[0].id).toBe('b');
    expect(sortTasks(tasks, 'priority')[0].id).toBe('a');
    expect(matches('farmacia', 'Farmácia')).toBe(true);
    expect(localDate(new Date(2026, 9, 14, 23, 59))).toBe('2026-10-14');
  });
  it('calcula indicadores reais e exclui canceladas e conclusões fora da semana', () => {
    const tasks = [
      make('a', ''),
      make('b', '', 'concluida'),
      { ...make('c', '', 'concluida'), completedAt: '2026-10-01T12:00:00.000Z' },
      make('d', '', 'cancelada'),
    ];
    const p = { ...project, id: 'p', createdAt: '', updatedAt: '', example: false };
    const r = { ...resource, id: 'r', createdAt: '', updatedAt: '', example: false };
    expect(dashboardMetrics([p], tasks, [r], new Date('2026-10-14T20:00:00Z'))).toEqual({
      active: 1,
      pending: 1,
      week: 1,
      reading: 1,
    });
  });
});
