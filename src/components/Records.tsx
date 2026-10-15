import { Link } from 'react-router-dom';
import {
  ArrowUpRight,
  MoreHorizontal,
  CalendarDays,
  Check,
  Undo2,
  Pencil,
  Trash2,
  BookOpen,
  FileText,
  GraduationCap,
  ExternalLink,
} from 'lucide-react';
import type { Project, Task, Resource } from '../models/schema';
import {
  priorities,
  projectStatuses,
  resourceStatuses,
  resourceTypes,
  taskStatuses,
} from '../models/schema';
import { useNexus } from '../hooks/WorkspaceContext';
import { Badge, Example, Progress, errorMessage, useNotice } from './UI';
import { projectProgress, resourceProgress, formatDate, localDate } from '../services/calculations';
import { saveTask } from '../services/repository';
export function ProjectCard({ project: p }: { project: Project }) {
  const { data, edit, remove } = useNexus();
  const area = data.areas.find((a) => a.id === p.areaId);
  return (
    <article className="project-card">
      <div className="card-top">
        <span className="area-tag">
          <i style={{ background: area?.color ?? '#89928c' }} />
          {area?.name ?? 'Sem área'}
        </span>
        <details className="menu">
          <summary aria-label={`Ações de ${p.name}`}>
            <MoreHorizontal size={20} />
          </summary>
          <div className="menu-popover">
            <button onClick={() => edit({ kind: 'project', record: p })}>
              <Pencil size={14} />
              Editar
            </button>
            <button onClick={() => remove({ kind: 'project', record: p })}>
              <Trash2 size={14} />
              Excluir
            </button>
          </div>
        </details>
      </div>
      <Link className="card-title" to={`/projetos/${p.id}`}>
        {p.name}
        <ArrowUpRight size={17} />
      </Link>
      <p className="card-description">
        {p.description || 'Adicione um objetivo e dê o próximo passo.'}
      </p>
      <div className="badges">
        <Badge
          tone={p.status === 'andamento' ? 'green' : p.status === 'concluido' ? 'blue' : 'neutral'}
        >
          {projectStatuses[p.status]}
        </Badge>
        <Badge tone={p.priority === 'alta' ? 'amber' : 'neutral'}>{priorities[p.priority]}</Badge>
        <Example value={p.example} />
      </div>
      <Progress value={projectProgress(p.id, data.tasks)} />
      <div className="card-footer">
        <span>
          <CalendarDays size={13} />
          {formatDate(p.deadline)}
        </span>
        <span>{data.tasks.filter((t) => t.projectId === p.id).length} tarefas</span>
      </div>
    </article>
  );
}
export function TaskRow({ task: t }: { task: Task }) {
  const { data, edit, remove } = useNexus();
  const notify = useNotice();
  const project = data.projects.find((p) => p.id === t.projectId);
  const overdue =
    t.deadline && t.deadline < localDate() && ['pendente', 'andamento'].includes(t.status);
  return (
    <div className={`task-row ${t.status === 'concluida' ? 'done' : ''}`}>
      <button
        className="task-check"
        aria-label={`${t.status === 'concluida' ? 'Reabrir' : 'Concluir'} ${t.title}`}
        onClick={async () => {
          try {
            await saveTask(
              { ...t, status: t.status === 'concluida' ? 'pendente' : 'concluida' },
              t.id,
            );
            notify(t.status === 'concluida' ? 'Tarefa reaberta.' : 'Tarefa concluída.');
          } catch (e) {
            notify(errorMessage(e), true);
          }
        }}
      >
        {t.status === 'concluida' ? (
          <Check size={15} />
        ) : t.status === 'cancelada' ? (
          <Undo2 size={13} />
        ) : null}
      </button>
      <div className="task-main">
        <Link to={`/tarefas/${t.id}`}>{t.title}</Link>
        <div className="task-meta">
          {project ? (
            <Link to={`/projetos/${project.id}`}>{project.name}</Link>
          ) : (
            <span>Sem projeto</span>
          )}
          <Example value={t.example} />
          <span>{taskStatuses[t.status]}</span>
        </div>
      </div>
      <Badge tone={t.priority === 'alta' ? 'amber' : 'neutral'}>{priorities[t.priority]}</Badge>
      <span className={`task-date ${overdue ? 'overdue' : ''}`}>
        {overdue ? 'Atrasada · ' : ''}
        {t.deadline === localDate() ? 'Hoje' : formatDate(t.deadline)}
      </span>
      <button
        className="icon-button"
        aria-label={`Editar ${t.title}`}
        onClick={() => edit({ kind: 'task', record: t })}
      >
        <Pencil size={15} />
      </button>
      <button
        className="icon-button delete-action"
        aria-label={`Excluir ${t.title}`}
        onClick={() => remove({ kind: 'task', record: t })}
      >
        <Trash2 size={15} />
      </button>
    </div>
  );
}
export function ResourceCard({ resource: r }: { resource: Resource }) {
  const { data, edit, remove } = useNexus();
  const Icon = r.type === 'livro' ? BookOpen : r.type === 'curso' ? GraduationCap : FileText;
  const progress = resourceProgress(r);
  return (
    <article className="resource-card">
      <div className="card-top">
        <div className="resource-icon">
          <Icon size={23} />
        </div>
        <details className="menu">
          <summary aria-label={`Ações de ${r.title}`}>
            <MoreHorizontal size={20} />
          </summary>
          <div className="menu-popover">
            <button onClick={() => edit({ kind: 'resource', record: r })}>
              <Pencil size={14} />
              Editar
            </button>
            <button onClick={() => remove({ kind: 'resource', record: r })}>
              <Trash2 size={14} />
              Excluir
            </button>
          </div>
        </details>
      </div>
      <span className="eyebrow">{resourceTypes[r.type]}</span>
      <Link to={`/biblioteca/${r.id}`} className="card-title">
        {r.title}
        <ArrowUpRight size={17} />
      </Link>
      <p className="card-description">
        {r.author || r.description || 'Seu próximo conhecimento começa aqui.'}
      </p>
      <div className="badges">
        <Badge tone={r.status === 'andamento' ? 'green' : 'neutral'}>
          {resourceStatuses[r.status]}
        </Badge>
        <Example value={r.example} />
      </div>
      {progress !== null && (
        <Progress
          value={progress}
          label={
            r.type === 'livro'
              ? `${r.currentPage} de ${r.totalPages} páginas`
              : `${r.completedLessons} de ${r.totalLessons} aulas`
          }
        />
      )}
      <div className="tags">
        {r.tags.map((tag) => (
          <span key={tag}>#{tag}</span>
        ))}
      </div>
      <div className="card-footer">
        <span>{data.areas.find((a) => a.id === r.areaId)?.name ?? 'Sem área'}</span>
        {r.url && (
          <a href={r.url} target="_blank" rel="noreferrer" aria-label={`Abrir link de ${r.title}`}>
            <ExternalLink size={15} />
          </a>
        )}
      </div>
    </article>
  );
}
