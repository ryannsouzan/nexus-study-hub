import { useState } from 'react';
import { CoverFields, type CoverDraft } from './CoverFields';
import { useForm } from 'react-hook-form';
import {
  areaInputSchema,
  projectInputSchema,
  taskInputSchema,
  resourceInputSchema,
  priorities,
  projectStatuses,
  taskStatuses,
  resourceStatuses,
  resourceTypes,
  type EntityKind,
  type Area,
  type Project,
  type Task,
  type Resource,
} from '../models/schema';
import { saveArea, saveProject, saveTask, saveResource } from '../services/repository';
import type { Workspace } from '../hooks/useWorkspace';
import { Modal, errorMessage, useNotice } from './UI';
type Values = {
  name: string;
  title: string;
  description: string;
  color: string;
  icon: Area['icon'];
  objective: string;
  areaId: string;
  projectId: string;
  projectIds: string[];
  status: string;
  priority: 'alta' | 'media' | 'baixa';
  startDate: string;
  deadline: string;
  author: string;
  subtitle: string;
  isbn: string;
  publisher: string;
  edition: string;
  coverUrl: string;
  type: Resource['type'];
  url: string;
  tags: string;
  totalPages: number;
  currentPage: number;
  doi: string;
  journal: string;
  year: number;
  platform: string;
  totalLessons: number;
  completedLessons: number;
};
export type EditorTarget = {
  kind: EntityKind;
  record?: Area | Project | Task | Resource;
  areaId?: string;
  projectId?: string;
};
const labels = { area: 'área', project: 'projeto', task: 'tarefa', resource: 'recurso' };
export function EntityEditor({
  target,
  data,
  onClose,
}: {
  target: EditorTarget;
  data: Workspace;
  onClose: () => void;
}) {
  const { kind, record } = target;
  const notify = useNotice();
  const source = record && 'coverId' in record ? record : undefined;
  const [cover, setCover] = useState<CoverDraft>({
    id: source?.coverId ?? '',
    url: source?.coverUrl ?? '',
  });
  const [coverBusy, setCoverBusy] = useState(false);
  const defaults: Values = {
    name: '',
    title: '',
    description: '',
    color: '#628d74',
    icon: 'flask',
    objective: '',
    areaId: target.areaId ?? '',
    projectId: target.projectId ?? '',
    projectIds: target.projectId ? [target.projectId] : [],
    status: kind === 'project' ? 'planejado' : kind === 'task' ? 'pendente' : 'desejo',
    priority: 'media',
    startDate: '',
    deadline: '',
    author: '',
    subtitle: '',
    isbn: '',
    publisher: '',
    edition: '',
    coverUrl: '',
    type: 'livro',
    url: '',
    totalPages: 0,
    currentPage: 0,
    doi: '',
    journal: '',
    year: 0,
    platform: '',
    totalLessons: 0,
    completedLessons: 0,
    ...record,
    tags: record && 'tags' in record ? record.tags.join(', ') : '',
  };
  const {
    register,
    handleSubmit,
    watch,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<Values>({ defaultValues: defaults });
  const resourceType = watch('type');
  const statuses =
    kind === 'project' ? projectStatuses : kind === 'task' ? taskStatuses : resourceStatuses;
  const submit = handleSubmit(async (values) => {
    if (coverBusy) return;
    const raw = {
      ...values,
      ...(kind === 'resource'
        ? {
            coverUrl: resourceType === 'livro' ? cover.url : '',
            coverId: resourceType === 'livro' ? cover.id : '',
          }
        : {}),
      tags: values.tags
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean),
    };
    const schema = {
      area: areaInputSchema,
      project: projectInputSchema,
      task: taskInputSchema,
      resource: resourceInputSchema,
    }[kind];
    const result = schema.safeParse(raw);
    if (!result.success) {
      for (const issue of result.error.issues)
        setError(issue.path[0] as keyof Values, { message: issue.message });
      return;
    }
    try {
      if (kind === 'area') await saveArea(areaInputSchema.parse(raw), record?.id);
      if (kind === 'project') await saveProject(projectInputSchema.parse(raw), record?.id);
      if (kind === 'task') await saveTask(taskInputSchema.parse(raw), record?.id);
      if (kind === 'resource')
        await saveResource(
          resourceInputSchema.parse(raw),
          record?.id,
          resourceType === 'livro' ? cover.upload : null,
        );
      notify(
        `${labels[kind][0].toUpperCase() + labels[kind].slice(1)} ${record ? 'atualizado' : 'criado'} com sucesso.`,
      );
      onClose();
    } catch (e) {
      setError('root', { message: errorMessage(e) });
    }
  });
  const fieldError = (key: keyof Values) =>
    errors[key] && (
      <span className="field-error" role="alert">
        {errors[key]?.message}
      </span>
    );
  return (
    <Modal
      open
      onClose={() => {
        if (!isSubmitting && !coverBusy) onClose();
      }}
      title={`${record ? 'Editar' : 'Criar'} ${labels[kind]}`}
      description="Organize suas informações. Os dados ficam salvos neste navegador."
    >
      <form onSubmit={submit} noValidate className="entity-form">
        <div className="form-grid">
          <label className="full">
            {kind === 'area' || kind === 'project' ? 'Nome' : 'Título'} *
            <input
              aria-label={kind === 'area' || kind === 'project' ? 'Nome *' : 'Título *'}
              aria-required="true"
              autoFocus
              {...register(kind === 'area' || kind === 'project' ? 'name' : 'title')}
              placeholder={
                kind === 'project'
                  ? 'Ex.: Aprender DoE'
                  : kind === 'task'
                    ? 'Qual é o próximo passo?'
                    : 'Como você quer chamar?'
              }
              maxLength={200}
            />
            {fieldError(kind === 'area' || kind === 'project' ? 'name' : 'title')}
          </label>
          <label className="full">
            Descrição
            <textarea
              {...register('description')}
              rows={3}
              placeholder="Contexto, anotações e detalhes…"
            />
            {fieldError('description')}
          </label>
          {kind === 'area' && (
            <>
              <label>
                Cor
                <input type="color" {...register('color')} />
                {fieldError('color')}
              </label>
              <label>
                Ícone
                <select {...register('icon')}>
                  <option value="flask">Laboratório</option>
                  <option value="code">Código</option>
                  <option value="book">Livro</option>
                  <option value="brain">Conhecimento</option>
                  <option value="globe">Idiomas</option>
                  <option value="leaf">Desenvolvimento</option>
                </select>
              </label>
            </>
          )}
          {(kind === 'project' || kind === 'resource') && (
            <label>
              Área
              <select {...register('areaId')}>
                <option value="">Sem área</option>
                {data.areas.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name}
                  </option>
                ))}
              </select>
              {fieldError('areaId')}
            </label>
          )}
          {kind === 'project' && (
            <label className="full">
              Objetivo
              <textarea
                {...register('objective')}
                rows={2}
                placeholder="Qual resultado você quer alcançar?"
              />
            </label>
          )}
          {kind === 'task' && (
            <label>
              Projeto
              <select {...register('projectId')}>
                <option value="">Sem projeto</option>
                {data.projects.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
              {fieldError('projectId')}
            </label>
          )}
          {kind !== 'area' && (
            <label>
              Status
              <select {...register('status')}>
                {Object.entries(statuses).map(([k, v]) => (
                  <option key={k} value={k}>
                    {v}
                  </option>
                ))}
              </select>
              {fieldError('status')}
            </label>
          )}
          {(kind === 'project' || kind === 'task') && (
            <>
              <label>
                Prioridade
                <select {...register('priority')}>
                  {Object.entries(priorities).map(([k, v]) => (
                    <option key={k} value={k}>
                      {v}
                    </option>
                  ))}
                </select>
              </label>
              {kind === 'project' && (
                <label>
                  Data de início
                  <input type="date" {...register('startDate')} />
                  {fieldError('startDate')}
                </label>
              )}
              <label>
                Prazo
                <input type="date" {...register('deadline')} />
                {fieldError('deadline')}
              </label>
            </>
          )}
          {kind === 'resource' && (
            <>
              <label>
                Tipo
                <select {...register('type')}>
                  {Object.entries(resourceTypes).map(([k, v]) => (
                    <option key={k} value={k}>
                      {v}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Autor ou responsável
                <input {...register('author')} />
              </label>
              <label className="full">
                Link
                <input type="url" {...register('url')} placeholder="https://…" />
                {fieldError('url')}
              </label>
              <label className="full">
                Tags (separadas por vírgula)
                <input {...register('tags')} placeholder="Ex.: estatística, cromatografia" />
                {fieldError('tags')}
              </label>
              <fieldset className="full relation-picker">
                <legend>Projetos associados</legend>
                {data.projects.length ? (
                  data.projects.map((p) => (
                    <label key={p.id} className="checkbox-label">
                      <input type="checkbox" value={p.id} {...register('projectIds')} />
                      {p.name}
                    </label>
                  ))
                ) : (
                  <p className="muted">Crie um projeto para vincular este recurso.</p>
                )}
                {fieldError('projectIds')}
              </fieldset>
              {resourceType === 'livro' && (
                <>
                  <label className="full">
                    Subtítulo
                    <input {...register('subtitle')} />
                    {fieldError('subtitle')}
                  </label>
                  <label>
                    ISBN-10 ou ISBN-13
                    <input
                      aria-label="ISBN-10 ou ISBN-13"
                      {...register('isbn')}
                      placeholder="978-…"
                    />
                    {fieldError('isbn')}
                  </label>
                  <label>
                    Editora
                    <input {...register('publisher')} />
                    {fieldError('publisher')}
                  </label>
                  <label>
                    Edição
                    <input {...register('edition')} placeholder="Ex.: 3ª edição" />
                    {fieldError('edition')}
                  </label>
                  <label>
                    Ano de publicação
                    <input
                      type="number"
                      min="0"
                      max="9999"
                      {...register('year', { setValueAs: (v) => (v === '' ? 0 : Number(v)) })}
                    />
                    {fieldError('year')}
                  </label>
                  <CoverFields
                    value={cover}
                    onChange={setCover}
                    onBusyChange={setCoverBusy}
                    title={watch('title')}
                    error={errors.coverUrl?.message}
                  />

                  <label>
                    Total de páginas
                    <input
                      type="number"
                      min="0"
                      {...register('totalPages', { valueAsNumber: true })}
                    />
                    {fieldError('totalPages')}
                  </label>
                  <label>
                    Página atual
                    <input
                      type="number"
                      min="0"
                      {...register('currentPage', { valueAsNumber: true })}
                    />
                    {fieldError('currentPage')}
                  </label>
                </>
              )}
              {resourceType === 'curso' && (
                <>
                  <label>
                    Plataforma
                    <input {...register('platform')} />
                  </label>
                  <label>
                    Total de aulas
                    <input
                      type="number"
                      min="0"
                      {...register('totalLessons', { valueAsNumber: true })}
                    />
                    {fieldError('totalLessons')}
                  </label>
                  <label>
                    Aulas concluídas
                    <input
                      type="number"
                      min="0"
                      {...register('completedLessons', { valueAsNumber: true })}
                    />
                    {fieldError('completedLessons')}
                  </label>
                </>
              )}
              {resourceType === 'artigo' && (
                <>
                  <label>
                    DOI
                    <input {...register('doi')} placeholder="10.…" />
                  </label>
                  <label>
                    Revista
                    <input {...register('journal')} />
                  </label>
                  <label>
                    Ano de publicação
                    <input
                      type="number"
                      min="0"
                      max="9999"
                      {...register('year', { valueAsNumber: true })}
                    />
                    {fieldError('year')}
                  </label>
                </>
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
            disabled={isSubmitting || coverBusy}
            onClick={onClose}
          >
            Cancelar
          </button>
          <button type="submit" className="button primary" disabled={isSubmitting || coverBusy}>
            {isSubmitting ? 'Salvando…' : record ? 'Salvar alterações' : 'Criar ' + labels[kind]}
          </button>
        </div>
      </form>
    </Modal>
  );
}
