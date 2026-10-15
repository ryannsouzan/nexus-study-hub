import type { Project, Resource, Task } from '../models/schema';
export function localDate(now = new Date()) {
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
}
export function projectProgress(projectId: string, tasks: Task[]) {
  const items = tasks.filter((t) => t.projectId === projectId && t.status !== 'cancelada');
  return items.length
    ? Math.round((items.filter((t) => t.status === 'concluida').length / items.length) * 100)
    : null;
}
export function resourceProgress(
  r: Pick<Resource, 'type' | 'totalPages' | 'currentPage' | 'totalLessons' | 'completedLessons'>,
) {
  if (r.type === 'livro' && r.totalPages > 0)
    return Math.round((r.currentPage / r.totalPages) * 100);
  if (r.type === 'curso' && r.totalLessons > 0)
    return Math.round((r.completedLessons / r.totalLessons) * 100);
  return null;
}
export type TaskView = 'todas' | 'hoje' | 'semana' | 'atrasadas' | 'concluidas';
export function filterTasks(tasks: Task[], view: TaskView, today = localDate()) {
  const next = new Date(`${today}T12:00:00`);
  next.setDate(next.getDate() + 7);
  const end = localDate(next);
  return tasks.filter((t) => {
    const open = t.status === 'pendente' || t.status === 'andamento';
    if (view === 'hoje') return open && !!t.deadline && t.deadline <= today;
    if (view === 'semana') return open && !!t.deadline && t.deadline >= today && t.deadline < end;
    if (view === 'atrasadas') return open && !!t.deadline && t.deadline < today;
    if (view === 'concluidas') return t.status === 'concluida';
    return true;
  });
}
export function sortTasks(tasks: Task[], sort: 'deadline' | 'priority') {
  const ranks = { alta: 0, media: 1, baixa: 2 };
  return [...tasks].sort((a, b) =>
    sort === 'priority'
      ? ranks[a.priority] - ranks[b.priority] || a.deadline.localeCompare(b.deadline)
      : (a.deadline || '9999').localeCompare(b.deadline || '9999') ||
        ranks[a.priority] - ranks[b.priority],
  );
}
export function dashboardMetrics(
  projects: Project[],
  tasks: Task[],
  resources: Resource[],
  now = new Date(),
) {
  const monday = new Date(now);
  monday.setHours(0, 0, 0, 0);
  monday.setDate(monday.getDate() - ((monday.getDay() + 6) % 7));
  return {
    active: projects.filter((p) => p.status === 'andamento').length,
    pending: tasks.filter((t) => ['pendente', 'andamento'].includes(t.status)).length,
    week: tasks.filter(
      (t) =>
        t.status === 'concluida' &&
        t.completedAt &&
        new Date(t.completedAt) >= monday &&
        new Date(t.completedAt) <= now,
    ).length,
    reading: resources.filter((r) => r.status === 'andamento').length,
  };
}
export const matches = (query: string, ...values: (string | undefined)[]) =>
  values.some((v) =>
    (v || '')
      .normalize('NFD')
      .replace(/\p{Diacritic}/gu, '')
      .toLocaleLowerCase('pt-BR')
      .includes(
        query
          .normalize('NFD')
          .replace(/\p{Diacritic}/gu, '')
          .toLocaleLowerCase('pt-BR'),
      ),
  );
export function formatDate(value: string) {
  return value
    ? new Date(`${value}T12:00:00`).toLocaleDateString('pt-BR', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
      })
    : 'Sem prazo';
}
