import { Link } from 'react-router-dom';
import { MoreHorizontal, Pencil, Trash2, FileText, GraduationCap } from 'lucide-react';
import type { Resource } from '../models/schema';
import { resourceStatuses, resourceTypes } from '../models/schema';
import { useNexus } from '../hooks/WorkspaceContext';
import { Badge, Example, Progress } from './UI';
import { resourceProgress } from '../services/calculations';
import { BookCover } from './BookCover';
export function ResourceActions({ resource: r }: { resource: Resource }) {
  const { edit, remove } = useNexus();
  return (
    <details className="menu resource-actions">
      <summary aria-label={`Ações de ${r.title}`}>
        <MoreHorizontal size={19} />
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
  );
}
export function BookCard({ resource: r }: { resource: Resource }) {
  const progress = resourceProgress(r);
  return (
    <article className="book-card">
      <div className="book-cover-link">
        <BookCover title={r.title} coverId={r.coverId} coverUrl={r.coverUrl} />
      </div>
      <div className="book-card-heading">
        <Link className="book-title" to={`/biblioteca/${r.id}`} title={r.title}>
          {r.title}
        </Link>
        <ResourceActions resource={r} />
      </div>
      <p className="book-author">{r.author || 'Autor não informado'}</p>
      <div className="badges">
        <Badge tone={r.status === 'andamento' ? 'green' : 'neutral'}>
          {resourceStatuses[r.status]}
        </Badge>
        <Example value={r.example} />
      </div>
      {progress !== null ? (
        <Progress value={progress} label={`${r.currentPage} de ${r.totalPages} páginas`} />
      ) : (
        <p className="book-no-progress">Páginas não informadas</p>
      )}
    </article>
  );
}
export function ResourceListRow({ resource: r }: { resource: Resource }) {
  const { data } = useNexus();
  const progress = resourceProgress(r);
  const Icon = r.type === 'curso' ? GraduationCap : FileText;
  return (
    <article className="resource-list-row">
      <Link
        className="resource-thumbnail"
        to={`/biblioteca/${r.id}`}
        aria-label={`Abrir ${r.title}`}
      >
        {r.type === 'livro' ? (
          <BookCover title={r.title} coverId={r.coverId} coverUrl={r.coverUrl} />
        ) : (
          <span className="list-resource-icon">
            <Icon size={24} />
          </span>
        )}
      </Link>
      <div className="resource-list-name">
        <Link className="book-title" to={`/biblioteca/${r.id}`}>
          {r.title}
        </Link>
        <p>{r.author || resourceTypes[r.type]}</p>
        <Example value={r.example} />
      </div>
      <span className="resource-list-area">
        {data.areas.find((a) => a.id === r.areaId)?.name ?? 'Sem área'}
      </span>
      <Badge tone={r.status === 'andamento' ? 'green' : 'neutral'}>
        {resourceStatuses[r.status]}
      </Badge>
      <div className="resource-list-progress">
        {progress !== null ? (
          <Progress value={progress} label="Progresso" />
        ) : (
          <span className="muted small">Sem progresso</span>
        )}
      </div>
      <ResourceActions resource={r} />
    </article>
  );
}
