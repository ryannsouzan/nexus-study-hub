import { BookDetails } from '../components/BookDetails';
import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeft, Pencil, Trash2, Link2, Unlink, Plus, ExternalLink } from 'lucide-react';
import { useNexus } from '../hooks/WorkspaceContext';
import {
  PageHeader,
  Badge,
  Progress,
  Example,
  Empty,
  Modal,
  errorMessage,
  useNotice,
} from '../components/UI';
import { ProjectCard, TaskRow, ResourceCard } from '../components/Records';
import {
  projectStatuses,
  priorities,
  taskStatuses,
  resourceStatuses,
  resourceTypes,
  type EntityKind,
  type Project,
} from '../models/schema';
import { projectProgress, resourceProgress, formatDate } from '../services/calculations';
import { saveProject, saveTask, saveResource } from '../services/repository';
export function Details({ kind }: { kind: EntityKind }) {
  const { id } = useParams();
  const { data, edit, remove } = useNexus();
  const notify = useNotice();
  const [linking, setLinking] = useState(false);
  const [resourceId, setResourceId] = useState('');
  const [taskId, setTaskId] = useState('');
  const [busy, setBusy] = useState(false);
  const record =
    kind === 'area'
      ? data.areas.find((a) => a.id === id)
      : kind === 'project'
        ? data.projects.find((p) => p.id === id)
        : kind === 'task'
          ? data.tasks.find((t) => t.id === id)
          : data.resources.find((r) => r.id === id);
  const paths = { area: '/areas', project: '/projetos', task: '/tarefas', resource: '/biblioteca' };
  if (!record)
    return (
      <Empty
        title="Registro não encontrado"
        description="Ele pode ter sido removido ou substituído por um backup."
        action={
          <Link className="button secondary" to={paths[kind]}>
            Voltar
          </Link>
        }
      />
    );
  const name = 'name' in record ? record.name : record.title;
  const project = kind === 'project' ? data.projects.find((p) => p.id === id) : undefined;
  const area = kind === 'area' ? data.areas.find((a) => a.id === id) : undefined;
  const task = kind === 'task' ? data.tasks.find((t) => t.id === id) : undefined;
  const resource = kind === 'resource' ? data.resources.find((r) => r.id === id) : undefined;
  async function act(action: () => Promise<unknown>, message: string) {
    try {
      await action();
      notify(message);
    } catch (e) {
      notify(errorMessage(e), true);
    }
  }
  const relatedProjects = area
    ? data.projects.filter((p) => p.areaId === id)
    : resource
      ? data.projects.filter((p) => resource.projectIds.includes(p.id))
      : [];
  const relatedResources = data.resources.filter((r) =>
    area ? r.areaId === id : r.projectIds.includes(id!),
  );
  if (resource?.type === 'livro')
    return <BookDetails key={`${resource.id}-${resource.currentPage}`} book={resource} />;
  return (
    <>
      <Link className="back-link" to={paths[kind]}>
        <ArrowLeft size={15} />
        Voltar
      </Link>
      <PageHeader
        eyebrow={
          {
            area: 'ÁREA DE CONHECIMENTO',
            project: 'PROJETO',
            task: 'TAREFA',
            resource: 'BIBLIOTECA',
          }[kind]
        }
        title={name}
        description={
          record.description || 'Adicione uma descrição para contextualizar este registro.'
        }
        action={
          <div className="inline-actions">
            <button className="button secondary" onClick={() => edit({ kind, record })}>
              <Pencil size={16} />
              Editar
            </button>
            <button className="button secondary" onClick={() => remove({ kind, record })}>
              <Trash2 size={16} />
              Excluir
            </button>
          </div>
        }
      />
      <div className="badges detail-badges">
        <Example value={record.example} />
        {project && (
          <>
            <Badge tone="green">{projectStatuses[project.status]}</Badge>
            <Badge>{priorities[project.priority]}</Badge>
          </>
        )}
        {task && (
          <>
            <Badge>{taskStatuses[task.status]}</Badge>
            <Badge>{priorities[task.priority]}</Badge>
          </>
        )}
        {resource && (
          <>
            <Badge>{resourceTypes[resource.type]}</Badge>
            <Badge tone="green">{resourceStatuses[resource.status]}</Badge>
          </>
        )}
      </div>
      {project && (
        <>
          <section className="panel detail-summary">
            <div>
              <p className="eyebrow">OBJETIVO</p>
              <p>{project.objective || 'Defina o resultado que você quer alcançar.'}</p>
              <dl>
                <div>
                  <dt>Área</dt>
                  <dd>
                    {project.areaId ? (
                      <Link to={`/areas/${project.areaId}`}>
                        {data.areas.find((a) => a.id === project.areaId)?.name}
                      </Link>
                    ) : (
                      'Sem área'
                    )}
                  </dd>
                </div>
                <div>
                  <dt>Início</dt>
                  <dd>{project.startDate ? formatDate(project.startDate) : 'Não definido'}</dd>
                </div>
                <div>
                  <dt>Prazo</dt>
                  <dd>{formatDate(project.deadline)}</dd>
                </div>
              </dl>
            </div>
            <div className="detail-progress">
              <Progress value={projectProgress(project.id, data.tasks)} />
              <label>
                Status do projeto
                <select
                  value={project.status}
                  onChange={(e) =>
                    act(
                      () =>
                        saveProject(
                          { ...project, status: e.target.value as Project['status'] },
                          project.id,
                        ),
                      'Status atualizado.',
                    )
                  }
                >
                  {Object.entries(projectStatuses).map(([k, v]) => (
                    <option key={k} value={k}>
                      {v}
                    </option>
                  ))}
                </select>
              </label>
            </div>
          </section>
          <section className="section">
            <div className="section-heading">
              <div>
                <h2>Tarefas do projeto</h2>
                <p>Tarefas canceladas não entram no cálculo de progresso.</p>
              </div>
              <button
                className="button secondary"
                onClick={() => edit({ kind: 'task', projectId: id })}
              >
                <Plus size={16} />
                Nova tarefa
              </button>
            </div>
            <div className="association-bar">
              <select
                aria-label="Tarefa para associar"
                value={taskId}
                onChange={(e) => setTaskId(e.target.value)}
              >
                <option value="">Selecionar tarefa sem projeto</option>
                {data.tasks
                  .filter((t) => !t.projectId)
                  .map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.title}
                    </option>
                  ))}
              </select>
              <button
                className="button secondary"
                disabled={!taskId}
                onClick={() =>
                  act(async () => {
                    const t = data.tasks.find((t) => t.id === taskId);
                    if (t) {
                      await saveTask({ ...t, projectId: id! }, t.id);
                      setTaskId('');
                    }
                  }, 'Tarefa associada.')
                }
              >
                <Link2 size={15} />
                Associar
              </button>
            </div>
            <div className="panel">
              {data.tasks.some((t) => t.projectId === id) ? (
                data.tasks
                  .filter((t) => t.projectId === id)
                  .map((t) => (
                    <div className="related-task" key={t.id}>
                      <TaskRow task={t} />
                      <button
                        className="icon-button"
                        aria-label={`Desvincular ${t.title}`}
                        onClick={() =>
                          act(
                            () => saveTask({ ...t, projectId: '' }, t.id),
                            'Tarefa desvinculada e preservada.',
                          )
                        }
                      >
                        <Unlink size={15} />
                      </button>
                    </div>
                  ))
              ) : (
                <Empty
                  title="Divida seu objetivo em pequenos passos"
                  description="Adicione a primeira tarefa a este projeto."
                />
              )}
            </div>
          </section>
        </>
      )}
      {(area || resource) && (
        <section className="section">
          <div className="section-heading">
            <h2>Projetos relacionados</h2>
            {area && (
              <button
                className="button secondary"
                onClick={() => edit({ kind: 'project', areaId: id })}
              >
                <Plus size={15} />
                Novo projeto
              </button>
            )}
            {resource && (
              <button
                className="button secondary"
                onClick={() => edit({ kind: 'resource', record: resource })}
              >
                <Link2 size={15} />
                Gerenciar vínculos
              </button>
            )}
          </div>
          {relatedProjects.length ? (
            <div className="cards-grid">
              {relatedProjects.map((p) => (
                <ProjectCard key={p.id} project={p} />
              ))}
            </div>
          ) : (
            <Empty title="Nenhum projeto relacionado" />
          )}
        </section>
      )}
      {(area || project) && (
        <section className="section">
          <div className="section-heading">
            <h2>Recursos relacionados</h2>
            <div className="inline-actions">
              {project && (
                <button className="button secondary" onClick={() => setLinking(true)}>
                  <Link2 size={15} />
                  Vincular recurso
                </button>
              )}
              <button
                className="button secondary"
                onClick={() => edit({ kind: 'resource', areaId: area?.id, projectId: project?.id })}
              >
                <Plus size={15} />
                Novo recurso
              </button>
            </div>
          </div>
          {relatedResources.length ? (
            <div className="cards-grid">
              {relatedResources.map((r) => (
                <div key={r.id}>
                  <ResourceCard resource={r} />
                  {project && (
                    <button
                      className="text-button"
                      onClick={() =>
                        act(
                          () =>
                            saveResource(
                              { ...r, projectIds: r.projectIds.filter((p) => p !== id) },
                              r.id,
                            ),
                          'Recurso desvinculado e preservado.',
                        )
                      }
                    >
                      <Unlink size={14} />
                      Desvincular
                    </button>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <Empty
              title="Suas referências, perto do objetivo"
              description="Vincule um material da biblioteca ou crie um novo recurso."
            />
          )}
        </section>
      )}
      {task && (
        <section className="panel detail-summary">
          <div>
            <dl>
              <div>
                <dt>Projeto</dt>
                <dd>
                  {task.projectId ? (
                    <Link to={`/projetos/${task.projectId}`}>
                      {data.projects.find((p) => p.id === task.projectId)?.name}
                    </Link>
                  ) : (
                    'Sem projeto'
                  )}
                </dd>
              </div>
              <div>
                <dt>Prazo</dt>
                <dd>{formatDate(task.deadline)}</dd>
              </div>
              <div>
                <dt>Conclusão</dt>
                <dd>
                  {task.completedAt
                    ? new Date(task.completedAt).toLocaleString('pt-BR')
                    : 'Não concluída'}
                </dd>
              </div>
            </dl>
          </div>
          <button
            className="button primary"
            onClick={() =>
              act(
                () =>
                  saveTask(
                    { ...task, status: task.status === 'concluida' ? 'pendente' : 'concluida' },
                    task.id,
                  ),
                task.status === 'concluida' ? 'Tarefa reaberta.' : 'Tarefa concluída.',
              )
            }
          >
            {task.status === 'concluida' ? 'Reabrir tarefa' : 'Concluir tarefa'}
          </button>
        </section>
      )}
      {resource && (
        <section className="panel detail-summary">
          <div>
            <dl>
              <div>
                <dt>Autor</dt>
                <dd>{resource.author || 'Não informado'}</dd>
              </div>
              <div>
                <dt>Área</dt>
                <dd>
                  {resource.areaId ? (
                    <Link to={`/areas/${resource.areaId}`}>
                      {data.areas.find((a) => a.id === resource.areaId)?.name}
                    </Link>
                  ) : (
                    'Sem área'
                  )}
                </dd>
              </div>
              {resource.type === 'artigo' && (
                <>
                  <div>
                    <dt>DOI</dt>
                    <dd>{resource.doi || 'Não informado'}</dd>
                  </div>
                  <div>
                    <dt>Revista / ano</dt>
                    <dd>
                      {resource.journal || 'Não informado'} {resource.year || ''}
                    </dd>
                  </div>
                </>
              )}
              {resource.type === 'curso' && (
                <div>
                  <dt>Plataforma</dt>
                  <dd>{resource.platform || 'Não informada'}</dd>
                </div>
              )}
            </dl>
            <div className="tags">
              {resource.tags.map((t) => (
                <span key={t}>#{t}</span>
              ))}
            </div>
            {resource.url && (
              <a className="button secondary" href={resource.url} target="_blank" rel="noreferrer">
                <ExternalLink size={15} />
                Abrir material
              </a>
            )}
          </div>
          {resource.type === 'curso' && (
            <div className="detail-progress">
              {resourceProgress(resource) !== null ? (
                <Progress
                  value={resourceProgress(resource)}
                  label={`${resource.completedLessons} de ${resource.totalLessons} aulas`}
                />
              ) : (
                <p>Informe o total para acompanhar o progresso.</p>
              )}
              <button
                className="button secondary"
                onClick={() => edit({ kind: 'resource', record: resource })}
              >
                Atualizar progresso
              </button>
            </div>
          )}
        </section>
      )}
      <section className="record-meta">
        <span>Criado em {new Date(record.createdAt).toLocaleString('pt-BR')}</span>
        <span>Atualizado em {new Date(record.updatedAt).toLocaleString('pt-BR')}</span>
      </section>
      {project && (
        <section className="panel history">
          <h2>Histórico de atualizações</h2>
          {data.activities.filter((a) => a.entityId === id).length ? (
            data.activities
              .filter((a) => a.entityId === id)
              .map((a) => (
                <p key={a.id}>
                  {a.action === 'created' ? 'Projeto criado' : 'Projeto atualizado'} ·{' '}
                  {new Date(a.at).toLocaleString('pt-BR')}
                </p>
              ))
          ) : (
            <p>Sem alterações registradas.</p>
          )}
        </section>
      )}
      {linking && (
        <Modal
          open
          onClose={() => {
            if (!busy) setLinking(false);
          }}
          title="Vincular recurso"
          description="O mesmo material pode apoiar vários projetos."
        >
          <label>
            Recurso da biblioteca
            <select value={resourceId} onChange={(e) => setResourceId(e.target.value)}>
              <option value="">Selecione um recurso</option>
              {data.resources
                .filter((r) => !r.projectIds.includes(id!))
                .map((r) => (
                  <option value={r.id} key={r.id}>
                    {r.title}
                  </option>
                ))}
            </select>
          </label>
          <div className="modal-actions">
            <button className="button secondary" onClick={() => setLinking(false)}>
              Cancelar
            </button>
            <button
              className="button primary"
              disabled={!resourceId || busy}
              onClick={async () => {
                setBusy(true);
                try {
                  const r = data.resources.find((r) => r.id === resourceId);
                  if (r) await saveResource({ ...r, projectIds: [...r.projectIds, id!] }, r.id);
                  notify('Recurso vinculado.');
                  setLinking(false);
                  setResourceId('');
                } catch (e) {
                  notify(errorMessage(e), true);
                } finally {
                  setBusy(false);
                }
              }}
            >
              {busy ? 'Salvando…' : 'Vincular'}
            </button>
          </div>
        </Modal>
      )}
    </>
  );
}
