import { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { Link, useParams, useSearchParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Plus, Pencil, Trash2, ArrowUp, ArrowDown, LockKeyhole } from 'lucide-react';
import { db } from '../../services/db';
import { useLearning } from '../../hooks/useLearning';
import { useNexus } from '../../hooks/WorkspaceContext';
import {
  pathStatuses,
  learningPriorities,
  stageStatuses,
  type LearningStage,
} from '../../models/learning';
import {
  orderedStages,
  nextStages,
  stageProgress,
  unmetPrerequisites,
  pathProgress,
  progressMethod,
  criterionMet,
} from '../../domain/learning';
import { deletePath, deleteStage, reorderStages } from '../../services/learning';
import {
  PageHeader,
  Badge,
  Example,
  Empty,
  ConfirmDialog,
  errorMessage,
  useNotice,
} from '../../components/UI';
import {
  LearningEditor,
  type LearningEditorTarget,
} from '../../components/learning/LearningEditor';
import { LearningProgress } from '../../components/learning/PathCard';
import { StagePanel } from '../../components/learning/StagePanel';
import { Roadmap } from '../../components/learning/Roadmap';
import { formatDate } from '../../services/calculations';
export function LearningPathDetails() {
  const { id } = useParams();
  const data = useLearning();
  const { data: workspace } = useNexus();
  const [search, setSearch] = useSearchParams();
  const navigate = useNavigate();
  const saved = useLiveQuery(() => db.settings.get('learning-view'), []);
  const view = saved?.value ?? 'list';
  const [editor, setEditor] = useState<LearningEditorTarget | null>(null);
  const [deletion, setDeletion] = useState<'path' | LearningStage | null>(null);
  const notify = useNotice();
  async function run(action: () => Promise<unknown>) {
    try {
      await action();
    } catch (e) {
      notify(errorMessage(e), true);
    }
  }
  if (!data) return <p role="status">Carregando sua trilha…</p>;
  const path = data.learningPaths.find((p) => p.id === id);
  if (!path)
    return (
      <Empty
        title="Trilha não encontrada"
        action={
          <Link className="button secondary" to="/trilhas">
            Voltar às trilhas
          </Link>
        }
      />
    );
  const stages = orderedStages(path.id, data);
  const selected = stages.find((s) => s.id === search.get('etapa')) ?? stages[0];
  const select = (stageId: string) => setSearch({ etapa: stageId }, { replace: true });
  const reorder = (index: number, offset: number) => {
    const ids = stages.map((s) => s.id);
    [ids[index], ids[index + offset]] = [ids[index + offset], ids[index]];
    return run(() => reorderStages(path.id, ids));
  };
  const progress = pathProgress(path.id, data);
  const stageButton = (s: LearningStage) => (
    <button
      className={`stage-select ${selected?.id === s.id ? 'selected' : ''}`}
      onClick={() => select(s.id)}
    >
      <span className="stage-number">{s.position + 1}</span>
      <span>
        <strong>{s.title}</strong>
        <small>
          {stageStatuses[s.status]} ·{' '}
          {unmetPrerequisites(s.id, data).length ? 'Bloqueada' : 'Disponível'}
          {s.estimatedHours ? ` · ${s.estimatedHours} h` : ''}
        </small>
        <small>{s.description}</small>
        <small>
          {data.learningDependencies.filter((d) => d.dependentStageId === s.id).length
            ? `Pré-requisitos: ${data.learningDependencies
                .filter((d) => d.dependentStageId === s.id)
                .map((d) => stages.find((x) => x.id === d.prerequisiteStageId)?.title)
                .join(', ')}`
            : 'Sem pré-requisitos'}
        </small>
      </span>
      {!!unmetPrerequisites(s.id, data).length && <LockKeyhole size={14} />}
    </button>
  );
  return (
    <>
      <Link className="back-link" to="/trilhas">
        <ArrowLeft size={14} />
        Todas as trilhas
      </Link>
      <PageHeader
        eyebrow="DESENVOLVIMENTO · TRILHA"
        title={path.title}
        description={path.objective || 'Defina o objetivo deste percurso.'}
        action={
          <div className="inline-actions">
            <button
              className="button secondary"
              onClick={() => setEditor({ kind: 'path', record: path })}
            >
              <Pencil size={15} />
              Editar trilha
            </button>
            <button className="button secondary" onClick={() => setDeletion('path')}>
              <Trash2 size={15} />
              Excluir trilha
            </button>
          </div>
        }
      />
      <div className="panel learning-path-summary">
        <div className="badges">
          <Badge tone="green">{pathStatuses[path.status]}</Badge>
          <Badge>{learningPriorities[path.priority]}</Badge>
          <Example value={path.example} />
          <span className="small muted">
            {path.estimatedHours ? `${path.estimatedHours} h estimadas · ` : ''}
            {formatDate(path.targetDate)}
          </span>
        </div>
        <p className="small muted">{path.description}</p>
        <div className="path-associations">
          Área:{' '}
          {path.areaId ? (
            <Link to={`/areas/${path.areaId}`}>
              {workspace.areas.find((a) => a.id === path.areaId)?.name}
            </Link>
          ) : (
            'Sem área'
          )}{' '}
          · Projeto:{' '}
          {path.projectId ? (
            <Link to={`/projetos/${path.projectId}`}>
              {workspace.projects.find((p) => p.id === path.projectId)?.name}
            </Link>
          ) : (
            'Sem projeto'
          )}
        </div>
        <LearningProgress {...progress} />
        <p className="calculation-note">{progressMethod}</p>
      </div>
      <div className="learning-view-header">
        <div className="tabs" role="group" aria-label="Visualização da trilha">
          {[
            ['list', 'Lista estruturada'],
            ['roadmap', 'Roadmap'],
            ['progress', 'Por progresso'],
          ].map(([key, label]) => (
            <button
              key={key}
              className={view === key ? 'active' : ''}
              aria-pressed={view === key}
              onClick={() => run(() => db.settings.put({ key: 'learning-view', value: key }))}
            >
              {label}
            </button>
          ))}
        </div>
        <button
          className="button primary"
          onClick={() => setEditor({ kind: 'stage', pathId: path.id })}
        >
          <Plus size={15} />
          Nova etapa
        </button>
      </div>
      {!stages.length ? (
        <Empty
          title="Dê forma ao seu percurso"
          description="Adicione etapas e defina como verificar o aprendizado."
        />
      ) : (
        <>
          <div className={`learning-workspace ${view === 'roadmap' ? 'with-roadmap' : ''}`}>
            <div className="learning-stage-navigation">
              {view === 'roadmap' ? (
                <Roadmap pathId={path.id} data={data} selected={selected?.id} onSelect={select} />
              ) : view === 'progress' ? (
                <div className="learning-progress-groups">
                  {[
                    { label: 'Concluídas', items: stages.filter((s) => s.status === 'completed') },
                    {
                      label: 'Em andamento',
                      items: stages.filter(
                        (s) => s.status === 'in_progress' && !unmetPrerequisites(s.id, data).length,
                      ),
                    },
                    {
                      label: 'Disponíveis',
                      items: stages.filter(
                        (s) => s.status === 'not_started' && !unmetPrerequisites(s.id, data).length,
                      ),
                    },
                    {
                      label: 'Bloqueadas',
                      items: stages.filter(
                        (s) => s.status !== 'completed' && unmetPrerequisites(s.id, data).length,
                      ),
                    },
                  ].map((group) => (
                    <section key={group.label}>
                      <h3>
                        {group.label} <span className="count">{group.items.length}</span>
                      </h3>
                      {group.items.map((s) => (
                        <div key={s.id}>{stageButton(s)}</div>
                      ))}
                    </section>
                  ))}
                  <section className="learning-recommendations">
                    <h3>Próximas ações recomendadas</h3>
                    {nextStages(path.id, data)
                      .slice(0, 3)
                      .map((s) => {
                        const pending = data.learningCriteria.find(
                          (c) => c.stageId === s.id && c.required && !criterionMet(c, data),
                        );
                        return (
                          <button className="text-button" key={s.id} onClick={() => select(s.id)}>
                            {s.title}:{' '}
                            {pending
                              ? pending.title
                              : stageProgress(s.id, data) === 100
                                ? 'Marcar etapa como concluída'
                                : 'Definir critérios obrigatórios'}{' '}
                            →
                          </button>
                        );
                      })}
                  </section>
                </div>
              ) : (
                <div className="stage-list">
                  {stages.map((s, index) => (
                    <article
                      className={`stage-list-item ${selected?.id === s.id ? 'selected' : ''}`}
                      key={s.id}
                    >
                      {stageButton(s)}
                      <div className="stage-list-bottom">
                        <LearningProgress value={stageProgress(s.id, data)} />
                        <div className="inline-actions">
                          <button
                            className="icon-button"
                            disabled={index === 0}
                            aria-label={`Mover ${s.title} para cima`}
                            onClick={() => reorder(index, -1)}
                          >
                            <ArrowUp size={15} />
                          </button>
                          <button
                            className="icon-button"
                            disabled={index === stages.length - 1}
                            aria-label={`Mover ${s.title} para baixo`}
                            onClick={() => reorder(index, 1)}
                          >
                            <ArrowDown size={15} />
                          </button>
                        </div>
                      </div>
                    </article>
                  ))}
                </div>
              )}
            </div>
            {selected && (
              <StagePanel
                key={selected.id}
                stage={selected}
                path={path}
                data={data}
                onEdit={setEditor}
                onDelete={() => setDeletion(selected)}
              />
            )}
          </div>
        </>
      )}
      {editor && (
        <LearningEditor
          key={`${editor.kind}-${editor.record?.id ?? 'new'}`}
          target={editor}
          data={data}
          onClose={() => setEditor(null)}
        />
      )}
      {deletion && (
        <ConfirmDialog
          title={deletion === 'path' ? 'Excluir trilha?' : `Excluir etapa “${deletion.title}”?`}
          description={
            deletion === 'path'
              ? 'Etapas, tópicos, critérios e associações desta trilha serão removidos. Tarefas, projetos e recursos independentes serão preservados.'
              : `Esta etapa possui ${data.learningDependencies.filter((d) => d.prerequisiteStageId === deletion.id).length} dependência(s) de saída. Elas serão removidas e etapas dependentes poderão ficar disponíveis. Tópicos e critérios da etapa serão excluídos; tarefas e materiais serão preservados.`
          }
          onClose={() => setDeletion(null)}
          onConfirm={async () => {
            if (deletion === 'path') {
              await deletePath(path.id);
              navigate('/trilhas');
            } else await deleteStage(deletion.id);
            notify('Exclusão concluída. Registros independentes preservados.');
          }}
        />
      )}
    </>
  );
}
