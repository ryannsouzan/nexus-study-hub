import { useForm } from 'react-hook-form';
import {
  pathInputSchema,
  stageInputSchema,
  topicInputSchema,
  criterionInputSchema,
  pathStatuses,
  learningPriorities,
  topicStatuses,
  type LearningPath,
  type LearningStage,
  type LearningTopic,
  type LearningCriterion,
} from '../../models/learning';
import { savePath, saveStage, saveTopic, saveCriterion } from '../../services/learning';
import { useNexus } from '../../hooks/WorkspaceContext';
import type { LearningSnapshot } from '../../domain/learning';
import { Modal, errorMessage, useNotice } from '../UI';
export type LearningEditorTarget = {
  kind: 'path' | 'stage' | 'topic' | 'criterion';
  record?: LearningPath | LearningStage | LearningTopic | LearningCriterion;
  pathId?: string;
  stageId?: string;
};
type Values = {
  title: string;
  description: string;
  objective: string;
  areaId: string;
  projectId: string;
  status: string;
  priority: string;
  estimatedHours: string;
  targetDate: string;
  learningObjectives: string;
  weight: string;
  type: string;
  targetId: string;
  required: boolean;
  checked: boolean;
  evidence: string;
};
const labels = { path: 'trilha', stage: 'etapa', topic: 'tópico', criterion: 'critério' };
export function LearningEditor({
  target,
  data,
  onClose,
}: {
  target: LearningEditorTarget;
  data: LearningSnapshot;
  onClose: () => void;
}) {
  const { data: workspace } = useNexus();
  const notify = useNotice();
  const record = target.record;
  const defaults: Values = {
    title: '',
    description: '',
    objective: '',
    areaId: '',
    projectId: '',
    status: target.kind === 'path' ? 'planned' : 'not_started',
    priority: 'medium',
    targetDate: '',
    type: 'manual',
    targetId: '',
    required: true,
    checked: false,
    evidence: '',
    ...record,
    estimatedHours:
      record && 'estimatedHours' in record && record.estimatedHours !== undefined
        ? String(record.estimatedHours)
        : '',
    weight:
      record && 'weight' in record && record.weight !== undefined ? String(record.weight) : '',
    learningObjectives:
      record && 'learningObjectives' in record ? record.learningObjectives.join('\n') : '',
  };
  const {
    register,
    watch,
    handleSubmit,
    setValue,
    formState: { isSubmitting },
    setError,
    formState: { errors },
  } = useForm<Values>({ defaultValues: defaults });
  const type = watch('type');
  const kind = target.kind;
  const stageId = target.stageId ?? (record && 'stageId' in record ? record.stageId : '');
  const submit = handleSubmit(async (values) => {
    const raw = {
      ...values,
      estimatedHours: values.estimatedHours === '' ? undefined : Number(values.estimatedHours),
      weight: values.weight === '' ? undefined : Number(values.weight),
      learningPathId:
        target.pathId ?? (record && 'learningPathId' in record ? record.learningPathId : ''),
      stageId,
      learningObjectives: values.learningObjectives
        .split('\n')
        .map((s) => s.trim())
        .filter(Boolean),
    };
    const result = {
      path: pathInputSchema,
      stage: stageInputSchema,
      topic: topicInputSchema,
      criterion: criterionInputSchema,
    }[kind].safeParse(raw);
    if (!result.success) {
      setError('root', { message: result.error.issues.map((i) => i.message).join(' ') });
      return;
    }
    try {
      if (kind === 'path') await savePath(pathInputSchema.parse(raw), record?.id);
      if (kind === 'stage') await saveStage(stageInputSchema.parse(raw), record?.id);
      if (kind === 'topic') await saveTopic(topicInputSchema.parse(raw), record?.id);
      if (kind === 'criterion') await saveCriterion(criterionInputSchema.parse(raw), record?.id);
      notify(`${labels[kind]} ${record ? 'atualizado' : 'criado'} com sucesso.`);
      onClose();
    } catch (e) {
      setError('root', { message: errorMessage(e) });
    }
  });
  return (
    <Modal
      open
      title={`${record ? 'Editar' : 'Criar'} ${labels[kind]}`}
      description="Salve agora e continue organizando quando quiser."
      onClose={() => {
        if (!isSubmitting) onClose();
      }}
    >
      <form noValidate onSubmit={submit}>
        <div className="form-grid">
          <label className="full">
            Título{' '}
            {kind === 'path'
              ? 'da trilha'
              : kind === 'stage'
                ? 'da etapa'
                : kind === 'topic'
                  ? 'do tópico'
                  : 'do critério'}{' '}
            *
            <input
              autoFocus
              aria-label={`Título ${kind === 'path' ? 'da trilha' : kind === 'stage' ? 'da etapa' : kind === 'topic' ? 'do tópico' : 'do critério'}`}
              {...register('title')}
              maxLength={200}
            />
          </label>
          {kind !== 'criterion' && (
            <label className="full">
              Descrição
              <textarea {...register('description')} rows={3} />
            </label>
          )}
          {kind === 'path' && (
            <>
              <label className="full">
                Objetivo da trilha
                <textarea {...register('objective')} rows={2} />
              </label>
              <label>
                Área
                <select aria-label="Área da trilha" {...register('areaId')}>
                  <option value="">Sem área</option>
                  {workspace.areas.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.name}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Projeto
                <select aria-label="Projeto da trilha" {...register('projectId')}>
                  <option value="">Sem projeto</option>
                  {workspace.projects.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Status
                <select aria-label="Status da trilha" {...register('status')}>
                  {Object.entries(pathStatuses).map(([k, v]) => (
                    <option key={k} value={k}>
                      {v}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Prioridade
                <select {...register('priority')}>
                  {Object.entries(learningPriorities).map(([k, v]) => (
                    <option key={k} value={k}>
                      {v}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Prazo
                <input type="date" {...register('targetDate')} />
              </label>
            </>
          )}
          {kind !== 'criterion' && (
            <label>
              Esforço estimado (horas)
              <input
                type="number"
                min="0.1"
                step="any"
                {...register('estimatedHours')}
                placeholder="Opcional"
              />
            </label>
          )}
          {kind === 'stage' && (
            <>
              <label>
                Peso no progresso
                <input
                  type="number"
                  min="0.1"
                  step="any"
                  {...register('weight')}
                  placeholder="Usar esforço ou peso 1"
                />
              </label>
              <label className="full">
                Objetivos de aprendizagem (um por linha)
                <textarea {...register('learningObjectives')} rows={4} />
              </label>
            </>
          )}
          {kind === 'topic' && (
            <label>
              Autoavaliação
              <select {...register('status')}>
                {Object.entries(topicStatuses).map(([k, v]) => (
                  <option key={k} value={k}>
                    {v}
                  </option>
                ))}
              </select>
              <small className="muted">
                Dominar um tópico é uma autoavaliação, independente da conclusão de tarefas.
              </small>
            </label>
          )}
          {kind === 'criterion' && (
            <>
              <label>
                Tipo de critério
                <select
                  aria-label="Tipo de critério"
                  {...register('type')}
                  onChange={(e) => {
                    setValue('type', e.target.value);
                    setValue('targetId', '');
                  }}
                >
                  <option value="manual">Avaliação manual</option>
                  <option value="evidence">Evidência prática</option>
                  <option value="task">Tarefa concluída</option>
                  <option value="topic">Tópico dominado</option>
                </select>
              </label>
              <label className="checkbox-label">
                <input type="checkbox" {...register('required')} />
                Obrigatório para concluir
              </label>
              {type === 'task' && (
                <label className="full">
                  Tarefa associada
                  <select aria-label="Tarefa do critério" {...register('targetId')}>
                    <option value="">Selecione uma tarefa vinculada</option>
                    {data.learningStageTasks
                      .filter((l) => l.stageId === stageId)
                      .map((l) => (
                        <option key={l.id} value={l.taskId}>
                          {data.tasks.find((t) => t.id === l.taskId)?.title}
                        </option>
                      ))}
                  </select>
                </label>
              )}
              {type === 'topic' && (
                <label className="full">
                  Tópico da etapa
                  <select aria-label="Tópico do critério" {...register('targetId')}>
                    <option value="">Selecione um tópico</option>
                    {data.learningTopics
                      .filter((t) => t.stageId === stageId)
                      .map((t) => (
                        <option key={t.id} value={t.id}>
                          {t.title}
                        </option>
                      ))}
                  </select>
                </label>
              )}
            </>
          )}
        </div>
        {errors.root && (
          <p className="error-panel" role="alert">
            {errors.root.message}
          </p>
        )}
        <div className="modal-actions">
          <button
            type="button"
            className="button secondary"
            disabled={isSubmitting}
            onClick={onClose}
          >
            Cancelar
          </button>
          <button className="button primary" disabled={isSubmitting}>
            {isSubmitting ? 'Salvando…' : record ? 'Salvar alterações' : `Criar ${labels[kind]}`}
          </button>
        </div>
      </form>
    </Modal>
  );
}
