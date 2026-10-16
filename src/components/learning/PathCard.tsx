import { Link } from 'react-router-dom';
import { ArrowRight, Pencil, Trash2, Archive } from 'lucide-react';
import { pathStatuses, learningPriorities, type LearningPath } from '../../models/learning';
import type { LearningSnapshot } from '../../domain/learning';
import { pathProgress, nextStages } from '../../domain/learning';
import { Badge, Example } from '../UI';
import { useNexus } from '../../hooks/WorkspaceContext';
import { formatDate } from '../../services/calculations';
export function LearningProgress({
  value,
  measured,
  total,
}: {
  value: number | null;
  measured?: number;
  total?: number;
}) {
  return (
    <div className="learning-progress">
      <div>
        <span>{value === null ? 'Sem progresso mensurável' : 'Critérios atendidos'}</span>
        {value !== null && <strong>{value}%</strong>}
      </div>
      <div
        className="progress-track"
        role="progressbar"
        aria-label="Progresso de aprendizagem"
        aria-valuenow={value ?? undefined}
        aria-valuemin={0}
        aria-valuemax={100}
      >
        <div style={{ width: `${value ?? 0}%` }} />
      </div>
      {measured !== undefined && (
        <small>
          {measured} de {total} etapas com critérios obrigatórios
        </small>
      )}
    </div>
  );
}
export function PathCard({
  path: p,
  data,
  onEdit,
  onDelete,
  onArchive,
}: {
  path: LearningPath;
  data: LearningSnapshot;
  onEdit?: () => void;
  onDelete?: () => void;
  onArchive?: () => void;
}) {
  const { data: workspace } = useNexus();
  const progress = pathProgress(p.id, data);
  const next = nextStages(p.id, data)[0];
  return (
    <article className="panel path-card">
      <div className="card-top">
        <span className="area-tag">
          {workspace.areas.find((a) => a.id === p.areaId)?.name ?? 'Sem área'}
        </span>
        <div className="inline-actions">
          {onEdit && (
            <button className="icon-button" aria-label={`Editar ${p.title}`} onClick={onEdit}>
              <Pencil size={14} />
            </button>
          )}
          {onArchive && p.status !== 'archived' && (
            <button className="icon-button" aria-label={`Arquivar ${p.title}`} onClick={onArchive}>
              <Archive size={14} />
            </button>
          )}
          {onDelete && (
            <button className="icon-button" aria-label={`Excluir ${p.title}`} onClick={onDelete}>
              <Trash2 size={14} />
            </button>
          )}
        </div>
      </div>
      <Link className="card-title" to={`/trilhas/${p.id}`}>
        {p.title}
        <ArrowRight size={16} />
      </Link>
      <p className="card-description">
        {p.objective || p.description || 'Defina seus objetivos de aprendizagem.'}
      </p>
      <div className="badges">
        <Badge tone={p.status === 'active' ? 'green' : 'neutral'}>{pathStatuses[p.status]}</Badge>
        <Badge>{learningPriorities[p.priority]}</Badge>
        <Example value={p.example} />
      </div>
      <LearningProgress {...progress} />
      <Link
        className="path-next"
        to={next ? `/trilhas/${p.id}?etapa=${next.id}` : `/trilhas/${p.id}`}
      >
        {next ? `Próxima: ${next.title}` : 'Nenhuma etapa disponível'}
        <ArrowRight size={13} />
      </Link>
      <div className="card-footer">
        <span>{progress.total} etapas</span>
        <span>{formatDate(p.targetDate)}</span>
      </div>
    </article>
  );
}
