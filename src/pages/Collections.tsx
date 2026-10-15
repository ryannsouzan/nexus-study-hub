import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Search, ArrowUpRight, LayoutGrid, Columns3, Pencil, Trash2 } from 'lucide-react';
import { useNexus } from '../hooks/WorkspaceContext';
import {
  areaIcons,
  PageHeader,
  NewButton,
  Empty,
  Example,
  errorMessage,
  useNotice,
} from '../components/UI';
import { ProjectCard, TaskRow, ResourceCard } from '../components/Records';
import {
  priorities,
  projectStatuses,
  taskStatuses,
  resourceStatuses,
  resourceTypes,
  type Project,
} from '../models/schema';
import { matches, filterTasks, sortTasks, type TaskView } from '../services/calculations';
import { saveProject } from '../services/repository';
function SearchInput({
  value,
  onChange,
  placeholder,
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
}) {
  return (
    <div className="collection-search">
      <Search size={16} />
      <input
        aria-label={placeholder}
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
    </div>
  );
}
export function Areas() {
  const { data, edit, remove } = useNexus();
  const [query, setQuery] = useState('');
  const areas = data.areas.filter((a) => matches(query, a.name, a.description));
  return (
    <>
      <PageHeader
        eyebrow="ORGANIZAÇÃO"
        title="Áreas de conhecimento"
        description="Os grandes temas que dão direção à sua jornada."
        action={<NewButton onClick={() => edit({ kind: 'area' })}>Nova área</NewButton>}
      />
      <div className="filters">
        <SearchInput value={query} onChange={setQuery} placeholder="Pesquisar áreas" />
        <span className="result-count">{areas.length} áreas</span>
      </div>
      {areas.length ? (
        <div className="cards-grid area-cards">
          {areas.map((a) => {
            const Icon = areaIcons[a.icon];
            return (
              <article key={a.id} className="area-card">
                <div className="card-top">
                  <span
                    className="area-icon"
                    style={{ color: a.color, background: `${a.color}18` }}
                  >
                    <Icon size={25} />
                  </span>
                  <div className="inline-actions">
                    <button
                      className="icon-button"
                      onClick={() => edit({ kind: 'area', record: a })}
                      aria-label={`Editar ${a.name}`}
                    >
                      <Pencil size={15} />
                    </button>
                    <button
                      className="icon-button"
                      onClick={() => remove({ kind: 'area', record: a })}
                      aria-label={`Excluir ${a.name}`}
                    >
                      <Trash2 size={15} />
                    </button>
                  </div>
                </div>
                <Link className="card-title" to={`/areas/${a.id}`}>
                  {a.name}
                  <ArrowUpRight size={17} />
                </Link>
                <p className="card-description">
                  {a.description || 'Um espaço para desenvolver seu conhecimento.'}
                </p>
                <Example value={a.example} />
                <div className="area-card-counts">
                  <span>
                    <strong>{data.projects.filter((p) => p.areaId === a.id).length}</strong>{' '}
                    projetos
                  </span>
                  <span>
                    <strong>{data.resources.filter((r) => r.areaId === a.id).length}</strong>{' '}
                    recursos
                  </span>
                </div>
              </article>
            );
          })}
        </div>
      ) : (
        <Empty action={<NewButton onClick={() => edit({ kind: 'area' })}>Criar área</NewButton>} />
      )}
    </>
  );
}
export function Projects() {
  const { data, edit } = useNexus();
  const notify = useNotice();
  const [query, setQuery] = useState('');
  const [area, setArea] = useState('');
  const [status, setStatus] = useState('');
  const [priority, setPriority] = useState('');
  const [kanban, setKanban] = useState(false);
  const projects = data.projects.filter(
    (p) =>
      matches(query, p.name, p.description) &&
      (!area || p.areaId === area) &&
      (!status || p.status === status) &&
      (!priority || p.priority === priority),
  );
  return (
    <>
      <PageHeader
        eyebrow="ORGANIZAÇÃO"
        title="Projetos"
        description="Transforme curiosidade em objetivos e próximos passos."
        action={<NewButton onClick={() => edit({ kind: 'project' })}>Novo projeto</NewButton>}
      />
      <div className="filters">
        <SearchInput value={query} onChange={setQuery} placeholder="Pesquisar projetos" />
        <select
          aria-label="Filtrar projetos por área"
          value={area}
          onChange={(e) => setArea(e.target.value)}
        >
          <option value="">Todas as áreas</option>
          {data.areas.map((a) => (
            <option key={a.id} value={a.id}>
              {a.name}
            </option>
          ))}
        </select>
        <select
          aria-label="Filtrar projetos por status"
          value={status}
          onChange={(e) => setStatus(e.target.value)}
        >
          <option value="">Todos os status</option>
          {Object.entries(projectStatuses).map(([k, v]) => (
            <option key={k} value={k}>
              {v}
            </option>
          ))}
        </select>
        <select
          aria-label="Filtrar projetos por prioridade"
          value={priority}
          onChange={(e) => setPriority(e.target.value)}
        >
          <option value="">Todas as prioridades</option>
          {Object.entries(priorities).map(([k, v]) => (
            <option key={k} value={k}>
              {v}
            </option>
          ))}
        </select>
        <div className="view-toggle">
          <button
            aria-label="Visualização em cards"
            aria-pressed={!kanban}
            className={!kanban ? 'active' : ''}
            onClick={() => setKanban(false)}
          >
            <LayoutGrid size={17} />
          </button>
          <button
            aria-label="Visualização Kanban"
            aria-pressed={kanban}
            className={kanban ? 'active' : ''}
            onClick={() => setKanban(true)}
          >
            <Columns3 size={17} />
          </button>
        </div>
      </div>
      {kanban ? (
        <div className="kanban">
          {Object.entries(projectStatuses).map(([key, label]) => (
            <section key={key} className="kanban-column">
              <h2>
                <span className={`status-dot ${key}`} />
                {label}
                <small>{projects.filter((p) => p.status === key).length}</small>
              </h2>
              {projects
                .filter((p) => p.status === key)
                .map((p) => (
                  <div key={p.id}>
                    <ProjectCard project={p} />
                    <select
                      className="kanban-status"
                      aria-label={`Status de ${p.name}`}
                      value={p.status}
                      onChange={async (e) => {
                        try {
                          await saveProject(
                            { ...p, status: e.target.value as Project['status'] },
                            p.id,
                          );
                          notify('Status atualizado.');
                        } catch (error) {
                          notify(errorMessage(error), true);
                        }
                      }}
                    >
                      {Object.entries(projectStatuses).map(([k, v]) => (
                        <option key={k} value={k}>
                          {v}
                        </option>
                      ))}
                    </select>
                  </div>
                ))}
              {!projects.some((p) => p.status === key) && (
                <p className="kanban-empty">Nenhum projeto</p>
              )}
            </section>
          ))}
        </div>
      ) : projects.length ? (
        <div className="cards-grid">
          {projects.map((p) => (
            <ProjectCard key={p.id} project={p} />
          ))}
        </div>
      ) : (
        <Empty />
      )}
    </>
  );
}
export function Tasks({ today = false }: { today?: boolean }) {
  const { data, edit } = useNexus();
  const [query, setQuery] = useState('');
  const [view, setView] = useState<TaskView>('todas');
  const [status, setStatus] = useState('');
  const [project, setProject] = useState('');
  const [sort, setSort] = useState<'deadline' | 'priority'>('deadline');
  const tasks = sortTasks(
    filterTasks(data.tasks, today ? 'hoje' : view).filter(
      (t) =>
        matches(query, t.title, t.description) &&
        (!status || t.status === status) &&
        (!project || t.projectId === project),
    ),
    sort,
  );
  const views: Record<TaskView, string> = {
    todas: 'Todas',
    hoje: 'Hoje',
    semana: 'Próximos 7 dias',
    atrasadas: 'Atrasadas',
    concluidas: 'Concluídas',
  };
  return (
    <>
      <PageHeader
        eyebrow={today ? 'VISÃO GERAL' : 'ORGANIZAÇÃO'}
        title={today ? 'Um passo de cada vez.' : 'Tarefas'}
        description={
          today
            ? 'Seu foco para hoje: tarefas do dia e pendências anteriores.'
            : 'Organize ações concretas e acompanhe cada avanço.'
        }
        action={<NewButton onClick={() => edit({ kind: 'task' })}>Nova tarefa</NewButton>}
      />
      {!today && (
        <div className="tabs" role="group" aria-label="Visualização de tarefas">
          {Object.entries(views).map(([k, v]) => (
            <button
              key={k}
              aria-pressed={view === k}
              className={view === k ? 'active' : ''}
              onClick={() => setView(k as TaskView)}
            >
              {v}
            </button>
          ))}
        </div>
      )}
      <div className="filters">
        <SearchInput value={query} onChange={setQuery} placeholder="Pesquisar tarefas" />
        <select
          aria-label="Filtrar tarefas por status"
          value={status}
          onChange={(e) => setStatus(e.target.value)}
        >
          <option value="">Todos os status</option>
          {Object.entries(taskStatuses).map(([k, v]) => (
            <option key={k} value={k}>
              {v}
            </option>
          ))}
        </select>
        <select
          aria-label="Filtrar tarefas por projeto"
          value={project}
          onChange={(e) => setProject(e.target.value)}
        >
          <option value="">Todos os projetos</option>
          {data.projects.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>
        <select
          aria-label="Ordenar tarefas"
          value={sort}
          onChange={(e) => setSort(e.target.value as 'deadline' | 'priority')}
        >
          <option value="deadline">Ordenar por prazo</option>
          <option value="priority">Ordenar por prioridade</option>
        </select>
      </div>
      <section className="panel">
        <div className="list-heading">
          <span>
            {tasks.length} {tasks.length === 1 ? 'tarefa' : 'tarefas'}
          </span>
          <span>Prioridade · Prazo</span>
        </div>
        {tasks.length ? (
          <div className="task-list">
            {tasks.map((t) => (
              <TaskRow key={t.id} task={t} />
            ))}
          </div>
        ) : (
          <Empty
            title={today ? 'Seu dia está livre de pendências' : 'Nenhuma tarefa encontrada'}
            description={
              today
                ? 'Tarefas sem prazo continuam disponíveis na página Tarefas.'
                : 'Crie uma tarefa ou experimente outros filtros.'
            }
          />
        )}
      </section>
    </>
  );
}
export function Library() {
  const { data, edit } = useNexus();
  const [query, setQuery] = useState('');
  const [type, setType] = useState('');
  const [status, setStatus] = useState('');
  const resources = data.resources.filter(
    (r) =>
      matches(query, r.title, r.description, r.author, ...r.tags) &&
      (!type || r.type === type) &&
      (!status || r.status === status),
  );
  return (
    <>
      <PageHeader
        eyebrow="CONHECIMENTO"
        title="Biblioteca pessoal"
        description="Boas referências, novas perspectivas. Tudo no seu lugar."
        action={<NewButton onClick={() => edit({ kind: 'resource' })}>Novo recurso</NewButton>}
      />
      <div className="filters">
        <SearchInput value={query} onChange={setQuery} placeholder="Pesquisar na biblioteca" />
        <select
          aria-label="Filtrar recursos por tipo"
          value={type}
          onChange={(e) => setType(e.target.value)}
        >
          <option value="">Todos os tipos</option>
          {Object.entries(resourceTypes).map(([k, v]) => (
            <option key={k} value={k}>
              {v}
            </option>
          ))}
        </select>
        <select
          aria-label="Filtrar recursos por status"
          value={status}
          onChange={(e) => setStatus(e.target.value)}
        >
          <option value="">Todos os status</option>
          {Object.entries(resourceStatuses).map(([k, v]) => (
            <option key={k} value={k}>
              {v}
            </option>
          ))}
        </select>
        <span className="result-count">{resources.length} recursos</span>
      </div>
      {resources.length ? (
        <div className="cards-grid">
          {resources.map((r) => (
            <ResourceCard key={r.id} resource={r} />
          ))}
        </div>
      ) : (
        <Empty />
      )}
    </>
  );
}
