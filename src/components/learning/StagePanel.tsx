import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Pencil, Trash2, Plus, LockKeyhole, Unlink, CheckCircle2 } from 'lucide-react';
import type { LearningStage, LearningPath, LearningCriterion } from '../../models/learning';
import { stageStatuses, topicStatuses } from '../../models/learning';
import {
  criterionMet,
  stageProgress,
  unmetPrerequisites,
  assertAcyclic,
  type LearningSnapshot,
} from '../../domain/learning';
import {
  setStageStatus,
  saveTopic,
  deleteTopic,
  saveCriterion,
  deleteCriterion,
  linkStageTask,
  unlinkStageTask,
  linkStageResource,
  unlinkStageResource,
  addDependency,
  deleteDependency,
} from '../../services/learning';
import { useNexus } from '../../hooks/WorkspaceContext';
import { Badge, ConfirmDialog, Empty, errorMessage, useNotice } from '../UI';
import { TaskRow } from '../Records';
import { LearningProgress } from './PathCard';
import type { LearningEditorTarget } from './LearningEditor';
function CriterionItem({
  criterion: c,
  data,
  onEdit,
  onDelete,
}: {
  criterion: LearningCriterion;
  data: LearningSnapshot;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const [evidence, setEvidence] = useState(c.evidence);
  const [checked, setChecked] = useState(c.checked);
  const [busy, setBusy] = useState(false);
  const notify = useNotice();
  async function update(input: LearningCriterion) {
    setBusy(true);
    try {
      await saveCriterion(input, c.id);
      notify('Critério atualizado.');
    } catch (e) {
      setChecked(c.checked);
      notify(errorMessage(e), true);
    } finally {
      setBusy(false);
    }
  }
  const met = criterionMet(c, data);
  return (
    <article className={`criterion-item ${met ? 'met' : ''}`}>
      <div className="criterion-heading">
        <CheckCircle2 size={17} />
        <div>
          <strong>{c.title}</strong>
          <small>
            {c.required ? 'Obrigatório' : 'Opcional'} ·{' '}
            {
              {
                manual: 'Avaliação manual',
                evidence: 'Evidência prática',
                task: 'Tarefa concluída',
                topic: 'Tópico dominado (autoavaliação)',
              }[c.type]
            }{' '}
            · {met ? 'Atendido' : 'Pendente'}
          </small>
        </div>
        <button className="icon-button" aria-label={`Editar critério ${c.title}`} onClick={onEdit}>
          <Pencil size={14} />
        </button>
        <button
          className="icon-button"
          aria-label={`Excluir critério ${c.title}`}
          onClick={onDelete}
        >
          <Trash2 size={14} />
        </button>
      </div>
      {c.type === 'manual' && (
        <label className="checkbox-label">
          <input
            type="checkbox"
            checked={checked}
            disabled={busy}
            onChange={(e) => {
              setChecked(e.target.checked);
              void update({ ...c, checked: e.target.checked });
            }}
          />
          Avaliação atendida: {c.title}
        </label>
      )}
      {c.type === 'evidence' && (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void update({ ...c, evidence });
          }}
        >
          <label>
            Evidência: {c.title}
            <textarea
              aria-label={`Evidência: ${c.title}`}
              value={evidence}
              onChange={(e) => setEvidence(e.target.value)}
              rows={3}
              maxLength={10000}
              placeholder="Descreva a aplicação prática, resultado, reflexão ou endereço de sua evidência."
            />
          </label>
          <button className="button secondary" disabled={busy}>
            {busy ? 'Salvando…' : 'Salvar evidência'}
          </button>
        </form>
      )}
      {c.type === 'task' && (
        <Link className="small text-link" to={`/tarefas/${c.targetId}`}>
          {data.tasks.find((t) => t.id === c.targetId)?.title} →
        </Link>
      )}
      {c.type === 'topic' && (
        <p className="small muted">
          {data.learningTopics.find((t) => t.id === c.targetId)?.title} · Atualize sua autoavaliação
          na seção Tópicos.
        </p>
      )}
    </article>
  );
}
export function StagePanel({
  stage: s,
  path,
  data,
  onEdit,
  onDelete,
}: {
  stage: LearningStage;
  path: LearningPath;
  data: LearningSnapshot;
  onEdit: (target: LearningEditorTarget) => void;
  onDelete: () => void;
}) {
  const { data: workspace, edit } = useNexus();
  const notify = useNotice();
  const [taskId, setTaskId] = useState(''),
    [resourceId, setResourceId] = useState(''),
    [prerequisite, setPrerequisite] = useState('');
  const [confirmation, setConfirmation] = useState<{
    title: string;
    description: string;
    action: () => Promise<unknown>;
  } | null>(null);
  async function run(action: () => Promise<unknown>, message = 'Alteração salva.') {
    try {
      await action();
      notify(message);
    } catch (e) {
      notify(errorMessage(e), true);
    }
  }
  const blocked = unmetPrerequisites(s.id, data);
  const dependencies = data.learningDependencies.filter((d) => d.dependentStageId === s.id);
  const valid = data.learningStages.filter((candidate) => {
    if (
      candidate.learningPathId !== path.id ||
      candidate.id === s.id ||
      dependencies.some((d) => d.prerequisiteStageId === candidate.id)
    )
      return false;
    try {
      assertAcyclic(data.learningStages, [
        ...data.learningDependencies,
        {
          id: 'candidate',
          learningPathId: path.id,
          prerequisiteStageId: candidate.id,
          dependentStageId: s.id,
          createdAt: new Date().toISOString(),
        },
      ]);
      return true;
    } catch {
      return false;
    }
  });
  const taskLinks = data.learningStageTasks.filter((l) => l.stageId === s.id),
    resourceLinks = data.learningStageResources.filter((l) => l.stageId === s.id);
  const criteria = data.learningCriteria.filter((c) => c.stageId === s.id);
  const progress = stageProgress(s.id, data);
  return (
    <section className="panel learning-stage-panel" aria-label={`Detalhes da etapa ${s.title}`}>
      <div className="stage-panel-header">
        <div>
          <p className="eyebrow">ETAPA {s.position + 1}</p>
          <h2>{s.title}</h2>
        </div>
        <div className="inline-actions">
          <button
            className="icon-button"
            aria-label="Editar etapa selecionada"
            onClick={() => onEdit({ kind: 'stage', record: s, pathId: path.id })}
          >
            <Pencil size={16} />
          </button>
          <button className="icon-button" aria-label="Excluir etapa selecionada" onClick={onDelete}>
            <Trash2 size={16} />
          </button>
        </div>
      </div>
      <p className="stage-description">
        {s.description || 'Adicione uma descrição para orientar seus estudos.'}
      </p>
      <div className="badges">
        <Badge tone={s.status === 'completed' ? 'green' : 'neutral'}>
          {stageStatuses[s.status]}
        </Badge>
        <Badge tone={blocked.length ? 'amber' : 'green'}>
          {blocked.length ? 'Bloqueada por pré-requisitos' : 'Disponível'}
        </Badge>
        {s.estimatedHours && <Badge>{s.estimatedHours} h estimadas</Badge>}
      </div>
      {!!blocked.length && (
        <div className="learning-warning">
          <LockKeyhole size={17} />
          <span>
            Conclua primeiro: {blocked.map((x) => x.title).join(', ')}. Você pode consultar os
            materiais enquanto isso.
          </span>
        </div>
      )}
      <LearningProgress value={progress} />
      <p className="calculation-note">
        Progresso = critérios obrigatórios atendidos ÷ critérios obrigatórios definidos. Tarefas
        concluídas não representam, por si só, domínio de conhecimentos.
      </p>
      <div className="stage-status-actions">
        <button
          className="button secondary"
          disabled={s.status === 'in_progress'}
          onClick={() => run(() => setStageStatus(s.id, 'in_progress'))}
        >
          Em andamento
        </button>
        <button
          className="button primary"
          disabled={s.status === 'completed' || !!blocked.length || progress !== 100}
          onClick={() =>
            run(
              () => setStageStatus(s.id, 'completed'),
              'Etapa concluída. Próximas etapas reavaliadas.',
            )
          }
        >
          Concluir etapa
        </button>
        {s.status === 'completed' && (
          <button
            className="text-button"
            onClick={() =>
              setConfirmation({
                title: 'Reabrir etapa?',
                description:
                  'Etapas dependentes concluídas e a conclusão da trilha serão reavaliadas. Tarefas e tópicos serão preservados.',
                action: () => setStageStatus(s.id, 'in_progress'),
              })
            }
          >
            Reabrir etapa
          </button>
        )}
      </div>
      {s.learningObjectives.length > 0 && (
        <section className="learning-section">
          <h3>Objetivos de aprendizagem</h3>
          <ul>
            {s.learningObjectives.map((objective, i) => (
              <li key={i}>{objective}</li>
            ))}
          </ul>
        </section>
      )}
      <section className="learning-section">
        <div className="section-heading">
          <h3>Pré-requisitos</h3>
        </div>
        {dependencies.length ? (
          dependencies.map((d) => {
            const item = data.learningStages.find((x) => x.id === d.prerequisiteStageId)!;
            return (
              <div className="learning-link-row" key={d.id}>
                <span>
                  {item.title}
                  <small>{stageStatuses[item.status]}</small>
                </span>
                <button
                  className="icon-button"
                  aria-label={`Remover pré-requisito ${item.title}`}
                  onClick={() =>
                    setConfirmation({
                      title: 'Remover pré-requisito?',
                      description:
                        'A etapa poderá ficar disponível sem esse pré-requisito. Os conteúdos de ambas serão preservados.',
                      action: () => deleteDependency(d.id),
                    })
                  }
                >
                  <Unlink size={14} />
                </button>
              </div>
            );
          })
        ) : (
          <p className="small muted">Esta etapa não possui pré-requisitos.</p>
        )}
        <div className="association-bar">
          <select
            aria-label="Adicionar pré-requisito"
            value={prerequisite}
            onChange={(e) => setPrerequisite(e.target.value)}
          >
            <option value="">Selecionar etapa válida</option>
            {valid.map((x) => (
              <option key={x.id} value={x.id}>
                {x.title}
              </option>
            ))}
          </select>
          <button
            className="button secondary"
            disabled={!prerequisite}
            onClick={() =>
              run(async () => {
                await addDependency(prerequisite, s.id);
                setPrerequisite('');
              })
            }
          >
            Adicionar pré-requisito
          </button>
        </div>
        <p className="calculation-note">
          Somente etapas desta trilha que não criam ciclos são oferecidas. Uma etapa não pode
          depender de si mesma.
        </p>
      </section>
      <section className="learning-section">
        <div className="section-heading">
          <h3>Tópicos</h3>
          <button
            className="button secondary"
            onClick={() => onEdit({ kind: 'topic', stageId: s.id })}
          >
            <Plus size={14} />
            Novo tópico
          </button>
        </div>
        <p className="calculation-note">
          O estado “Dominado” é uma autoavaliação. Use critérios de tópico para torná-la
          obrigatória.
        </p>
        {data.learningTopics
          .filter((t) => t.stageId === s.id)
          .map((t) => (
            <div className="learning-topic" key={t.id}>
              <div>
                <strong>{t.title}</strong>
                <p>{t.description}</p>
                {t.estimatedHours && <small>{t.estimatedHours} h estimadas</small>}
              </div>
              <select
                aria-label={`Autoavaliação de ${t.title}`}
                value={t.status}
                onChange={(e) =>
                  run(() => saveTopic({ ...t, status: e.target.value as typeof t.status }, t.id))
                }
              >
                {Object.entries(topicStatuses).map(([k, v]) => (
                  <option key={k} value={k}>
                    {v}
                  </option>
                ))}
              </select>
              <button
                className="icon-button"
                aria-label={`Editar tópico ${t.title}`}
                onClick={() => onEdit({ kind: 'topic', record: t, stageId: s.id })}
              >
                <Pencil size={14} />
              </button>
              <button
                className="icon-button"
                aria-label={`Excluir tópico ${t.title}`}
                onClick={() =>
                  setConfirmation({
                    title: 'Excluir tópico?',
                    description:
                      'O tópico e seus critérios serão removidos; a conclusão da etapa será reavaliada.',
                    action: () => deleteTopic(t.id),
                  })
                }
              >
                <Trash2 size={14} />
              </button>
            </div>
          ))}
      </section>
      <section className="learning-section">
        <div className="section-heading">
          <h3>Critérios de conclusão</h3>
          <button
            className="button secondary"
            onClick={() => onEdit({ kind: 'criterion', stageId: s.id })}
          >
            <Plus size={14} />
            Novo critério
          </button>
        </div>
        {criteria.length ? (
          criteria.map((c) => (
            <CriterionItem
              key={`${c.id}-${c.updatedAt}`}
              criterion={c}
              data={data}
              onEdit={() => onEdit({ kind: 'criterion', record: c, stageId: s.id })}
              onDelete={() =>
                setConfirmation({
                  title: 'Excluir critério?',
                  description:
                    'O critério será removido e o progresso recalculado. Uma etapa sem critérios obrigatórios não terá progresso mensurável.',
                  action: () => deleteCriterion(c.id),
                })
              }
            />
          ))
        ) : (
          <Empty
            title="Como você vai verificar o aprendizado?"
            description="Defina critérios obrigatórios para medir o progresso e permitir concluir esta etapa."
          />
        )}
      </section>
      <section className="learning-section">
        <div className="section-heading">
          <h3>Tarefas associadas</h3>
          <button
            className="button secondary"
            onClick={() => edit({ kind: 'task', stageId: s.id, projectId: path.projectId })}
          >
            <Plus size={14} />
            Nova tarefa na etapa
          </button>
        </div>
        <div className="association-bar">
          <select
            aria-label="Tarefa existente"
            value={taskId}
            onChange={(e) => setTaskId(e.target.value)}
          >
            <option value="">Selecionar tarefa existente</option>
            {workspace.tasks
              .filter((t) => !taskLinks.some((l) => l.taskId === t.id))
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
              run(async () => {
                await linkStageTask(s.id, taskId);
                setTaskId('');
              })
            }
          >
            Vincular tarefa
          </button>
        </div>
        {taskLinks.map((l) => {
          const task = data.tasks.find((t) => t.id === l.taskId);
          return task ? (
            <div className="related-task" key={l.id}>
              <TaskRow task={task} />
              <button
                className="icon-button"
                aria-label={`Desvincular tarefa ${task.title}`}
                onClick={() =>
                  setConfirmation({
                    title: 'Desvincular tarefa?',
                    description:
                      'A tarefa será preservada. Critérios desta etapa que exigem essa tarefa serão removidos e a conclusão será reavaliada.',
                    action: () => unlinkStageTask(l.id),
                  })
                }
              >
                <Unlink size={14} />
              </button>
            </div>
          ) : null;
        })}
      </section>
      <section className="learning-section">
        <div className="section-heading">
          <h3>Materiais da Biblioteca</h3>
          <Link className="text-link small" to="/biblioteca">
            Abrir Biblioteca →
          </Link>
        </div>
        <div className="association-bar">
          <select
            aria-label="Recurso da etapa"
            value={resourceId}
            onChange={(e) => setResourceId(e.target.value)}
          >
            <option value="">Selecionar material existente</option>
            {workspace.resources
              .filter((r) => !resourceLinks.some((l) => l.resourceId === r.id))
              .map((r) => (
                <option key={r.id} value={r.id}>
                  {r.title}
                </option>
              ))}
          </select>
          <button
            className="button secondary"
            disabled={!resourceId}
            onClick={() =>
              run(async () => {
                await linkStageResource(s.id, resourceId);
                setResourceId('');
              })
            }
          >
            Vincular material
          </button>
        </div>
        {resourceLinks.map((l) => {
          const r = workspace.resources.find((r) => r.id === l.resourceId);
          return r ? (
            <div className="learning-link-row" key={l.id}>
              <Link to={`/biblioteca/${r.id}`}>{r.title}</Link>
              <button
                className="icon-button"
                aria-label={`Desvincular material ${r.title}`}
                onClick={() =>
                  run(() => unlinkStageResource(l.id), 'Material desvinculado e preservado.')
                }
              >
                <Unlink size={14} />
              </button>
            </div>
          ) : null;
        })}
      </section>
      {confirmation && (
        <ConfirmDialog
          title={confirmation.title}
          description={confirmation.description}
          onClose={() => setConfirmation(null)}
          onConfirm={async () => {
            await confirmation.action();
            notify('Alteração salva.');
          }}
        />
      )}
    </section>
  );
}
