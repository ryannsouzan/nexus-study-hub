import { useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, Pencil, Trash2, ImagePlus, ExternalLink } from 'lucide-react';
import type { Resource } from '../models/schema';
import { resourceStatuses, resourceInputSchema } from '../models/schema';
import { useNexus } from '../hooks/WorkspaceContext';
import { saveResource } from '../services/repository';
import { resourceProgress } from '../services/calculations';
import { BookCover } from './BookCover';
import { CoverFields, type CoverDraft } from './CoverFields';
import {
  Badge,
  Example,
  Progress,
  Modal,
  ConfirmDialog,
  Empty,
  errorMessage,
  useNotice,
} from './UI';
import { ProjectCard } from './Records';
function CoverDialog({ book, onClose }: { book: Resource; onClose: () => void }) {
  const [cover, setCover] = useState<CoverDraft>({
    id: book.coverId ?? '',
    url: book.coverUrl ?? '',
  });
  const [processing, setProcessing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const notify = useNotice();
  return (
    <Modal
      open
      title="Alterar capa"
      description="A nova capa só será salva ao confirmar. As outras informações do livro serão preservadas."
      onClose={() => {
        if (!processing && !saving) onClose();
      }}
    >
      <CoverFields
        value={cover}
        onChange={(value) => {
          setError('');
          setCover(value);
        }}
        onBusyChange={setProcessing}
        title={book.title}
      />
      {error && (
        <p role="alert" className="error-panel">
          {error}
        </p>
      )}
      <div className="modal-actions">
        <button className="button secondary" disabled={processing || saving} onClick={onClose}>
          Cancelar
        </button>
        <button
          className="button primary"
          disabled={processing || saving}
          onClick={async () => {
            setSaving(true);
            try {
              const input = resourceInputSchema.safeParse({
                ...book,
                coverId: cover.id,
                coverUrl: cover.url,
              });
              if (!input.success) {
                setError(input.error.issues[0].message);
                return;
              }
              await saveResource(input.data, book.id, cover.upload);
              notify('Capa atualizada.');
              onClose();
            } catch (e) {
              setError(errorMessage(e));
            } finally {
              setSaving(false);
            }
          }}
        >
          {saving ? 'Salvando…' : 'Salvar capa'}
        </button>
      </div>
    </Modal>
  );
}
export function BookDetails({ book }: { book: Resource }) {
  const { data, edit, remove } = useNexus();
  const notify = useNotice();
  const [coverOpen, setCoverOpen] = useState(false);
  const [removing, setRemoving] = useState(false);
  const [page, setPage] = useState(String(book.currentPage));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const area = data.areas.find((a) => a.id === book.areaId);
  const projects = data.projects.filter((p) => book.projectIds.includes(p.id));
  const progress = resourceProgress(book);
  return (
    <>
      <div className="book-detail-toolbar">
        <Link className="back-link" to="/biblioteca">
          <ArrowLeft size={15} />
          Biblioteca
        </Link>
        <div className="inline-actions">
          <button
            className="button secondary"
            onClick={() => edit({ kind: 'resource', record: book })}
          >
            <Pencil size={15} />
            Editar
          </button>
          <button
            className="button secondary"
            onClick={() => remove({ kind: 'resource', record: book })}
          >
            <Trash2 size={15} />
            Excluir
          </button>
        </div>
      </div>
      <article className="book-detail">
        <aside className="book-detail-cover">
          <BookCover title={book.title} coverId={book.coverId} coverUrl={book.coverUrl} eager />
          <button className="button secondary" onClick={() => setCoverOpen(true)}>
            <ImagePlus size={16} />
            {book.coverId || book.coverUrl ? 'Substituir capa' : 'Adicionar capa'}
          </button>
          {(book.coverId || book.coverUrl) && (
            <button className="text-button danger-text" onClick={() => setRemoving(true)}>
              Remover capa
            </button>
          )}
          <p className="cover-help">
            {book.coverId
              ? 'Capa salva neste navegador e incluída nos backups.'
              : book.coverUrl
                ? 'Capa externa: depende de internet e não é incorporada ao backup.'
                : 'Adicione uma capa para encontrar este livro mais facilmente.'}
          </p>
        </aside>
        <div className="book-detail-content">
          <p className="eyebrow">BIBLIOTECA · LIVRO</p>
          <h1>{book.title}</h1>
          {book.subtitle && <p className="book-subtitle">{book.subtitle}</p>}
          <p className="book-detail-author">{book.author || 'Autor não informado'}</p>
          <div className="badges">
            <Badge tone={book.status === 'andamento' ? 'green' : 'neutral'}>
              {resourceStatuses[book.status]}
            </Badge>
            <Example value={book.example} />
          </div>
          <dl className="book-metadata">
            <div>
              <dt>Editora</dt>
              <dd>{book.publisher || 'Não informada'}</dd>
            </div>
            <div>
              <dt>Edição</dt>
              <dd>{book.edition || 'Não informada'}</dd>
            </div>
            <div>
              <dt>Ano</dt>
              <dd>{book.year || 'Não informado'}</dd>
            </div>
            <div>
              <dt>ISBN</dt>
              <dd>{book.isbn || 'Não informado'}</dd>
            </div>
            <div>
              <dt>Área do conhecimento</dt>
              <dd>{area ? <Link to={`/areas/${area.id}`}>{area.name}</Link> : 'Sem área'}</dd>
            </div>
          </dl>
          <section className="book-reading">
            <h2>Sua leitura</h2>
            {progress !== null ? (
              <Progress
                value={progress}
                label={`${book.currentPage} de ${book.totalPages} páginas`}
              />
            ) : (
              <p className="small muted">
                Informe o total de páginas na edição do livro para acompanhar o progresso.
              </p>
            )}
            <form
              className="reading-form"
              noValidate
              onSubmit={async (e) => {
                e.preventDefault();
                const value = Number(page);
                if (
                  !page.trim() ||
                  !Number.isInteger(value) ||
                  value < 0 ||
                  value > book.totalPages
                ) {
                  setError(`Informe uma página inteira entre 0 e ${book.totalPages}.`);
                  return;
                }
                setError('');
                setSaving(true);
                try {
                  await saveResource({ ...book, currentPage: value }, book.id);
                  notify('Progresso de leitura atualizado.');
                } catch (e) {
                  setError(errorMessage(e));
                } finally {
                  setSaving(false);
                }
              }}
            >
              <label>
                Página atual
                <input
                  aria-label="Página atual de leitura"
                  type="number"
                  min="0"
                  max={book.totalPages}
                  step="1"
                  value={page}
                  onChange={(e) => setPage(e.target.value)}
                  disabled={saving}
                />
              </label>
              <button className="button primary" disabled={saving || book.totalPages === 0}>
                {saving ? 'Salvando…' : 'Atualizar leitura'}
              </button>
            </form>
            {error && (
              <p role="alert" className="field-error">
                {error}
              </p>
            )}
          </section>
          {book.description && (
            <section className="book-description">
              <h2>Sobre este livro</h2>
              <p>{book.description}</p>
            </section>
          )}
          <div className="tags">
            {book.tags.map((tag) => (
              <span key={tag}>#{tag}</span>
            ))}
          </div>
          {book.url && (
            <a
              className="button secondary book-material-link"
              href={book.url}
              target="_blank"
              rel="noreferrer"
            >
              <ExternalLink size={15} />
              Abrir material
            </a>
          )}
        </div>
      </article>
      <section className="section">
        <div className="section-heading">
          <div>
            <h2>Projetos vinculados</h2>
            <p>Conecte esta leitura aos seus objetivos.</p>
          </div>
          <button
            className="button secondary"
            onClick={() => edit({ kind: 'resource', record: book })}
          >
            Gerenciar vínculos
          </button>
        </div>
        {projects.length ? (
          <div className="cards-grid">
            {projects.map((p) => (
              <ProjectCard key={p.id} project={p} />
            ))}
          </div>
        ) : (
          <Empty
            title="Nenhum projeto vinculado"
            description="Associe este livro a um projeto para manter suas referências por perto."
          />
        )}
      </section>
      <section className="record-meta">
        <span>Criado em {new Date(book.createdAt).toLocaleString('pt-BR')}</span>
        <span>Atualizado em {new Date(book.updatedAt).toLocaleString('pt-BR')}</span>
      </section>
      {coverOpen && <CoverDialog book={book} onClose={() => setCoverOpen(false)} />}
      {removing && (
        <ConfirmDialog
          title="Remover capa?"
          description="O livro e seus vínculos serão preservados. A imagem local será removida se nenhum outro livro a utilizar."
          onClose={() => setRemoving(false)}
          onConfirm={async () => {
            await saveResource({ ...book, coverId: '', coverUrl: '' }, book.id, null);
            notify('Capa removida.');
          }}
        />
      )}
    </>
  );
}
