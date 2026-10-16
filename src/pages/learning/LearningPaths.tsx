import { useState } from 'react';
import { Search, Route, LockKeyhole, Layers, CheckCircle2, Plus } from 'lucide-react';
import { useLearning } from '../../hooks/useLearning';
import { useNexus } from '../../hooks/WorkspaceContext';
import { pathStatuses, type LearningPath } from '../../models/learning';
import { unmetPrerequisites } from '../../domain/learning';
import { savePath, deletePath } from '../../services/learning';
import { loadLearningExamples } from '../../services/learningExamples';
import { matches } from '../../services/calculations';
import { PageHeader, Empty, ConfirmDialog, errorMessage, useNotice } from '../../components/UI';
import { PathCard } from '../../components/learning/PathCard';
import {
  LearningEditor,
  type LearningEditorTarget,
} from '../../components/learning/LearningEditor';
export function LearningPaths() {
  const data = useLearning();
  const { data: workspace } = useNexus();
  const [query, setQuery] = useState(''),
    [area, setArea] = useState(''),
    [status, setStatus] = useState(''),
    [sort, setSort] = useState('priority');
  const [editor, setEditor] = useState<LearningEditorTarget | null>(null);
  const [deletion, setDeletion] = useState<LearningPath | null>(null);
  const [examples, setExamples] = useState(false);
  const notice = useNotice();
  if (!data) return <p role="status">Carregando trilhas…</p>;
  const rank = { high: 0, medium: 1, low: 2 };
  const paths = data.learningPaths
    .filter(
      (p) =>
        matches(query, p.title, p.description, p.objective) &&
        (!area || p.areaId === area) &&
        (!status || p.status === status),
    )
    .sort((a, b) =>
      sort === 'priority'
        ? rank[a.priority] - rank[b.priority] || b.updatedAt.localeCompare(a.updatedAt)
        : sort === 'deadline'
          ? (a.targetDate || '9999').localeCompare(b.targetDate || '9999')
          : b.updatedAt.localeCompare(a.updatedAt),
    );
  const stats = [
    { label: 'Total de trilhas', value: data.learningPaths.length, icon: Layers },
    {
      label: 'Trilhas ativas',
      value: data.learningPaths.filter((p) => p.status === 'active').length,
      icon: Route,
    },
    {
      label: 'Trilhas concluídas',
      value: data.learningPaths.filter((p) => p.status === 'completed').length,
      icon: CheckCircle2,
    },
    {
      label: 'Etapas disponíveis',
      value: data.learningStages.filter(
        (s) => s.status !== 'completed' && !unmetPrerequisites(s.id, data).length,
      ).length,
      icon: Plus,
    },
    {
      label: 'Etapas bloqueadas',
      value: data.learningStages.filter(
        (s) => s.status !== 'completed' && unmetPrerequisites(s.id, data).length,
      ).length,
      icon: LockKeyhole,
    },
  ];
  return (
    <>
      <PageHeader
        eyebrow="DESENVOLVIMENTO"
        title="Trilhas de aprendizagem"
        description="Conecte fundamentos, pratique com intenção e acompanhe o que você pode aprender agora."
        action={
          <button className="button primary" onClick={() => setEditor({ kind: 'path' })}>
            <Plus size={16} />
            Nova trilha
          </button>
        }
      />
      <section className="learning-stats" aria-label="Indicadores de trilhas">
        {stats.map((s) => (
          <article className="stat-card" key={s.label}>
            <div className="stat-label">
              {s.label}
              <s.icon size={17} />
            </div>
            <strong>{s.value}</strong>
          </article>
        ))}
      </section>
      <div className="filters">
        <div className="collection-search">
          <Search size={16} />
          <input
            aria-label="Pesquisar trilhas"
            placeholder="Pesquisar trilhas…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>
        <select
          aria-label="Filtrar trilhas por área"
          value={area}
          onChange={(e) => setArea(e.target.value)}
        >
          <option value="">Todas as áreas</option>
          {workspace.areas.map((a) => (
            <option key={a.id} value={a.id}>
              {a.name}
            </option>
          ))}
        </select>
        <select
          aria-label="Filtrar trilhas por status"
          value={status}
          onChange={(e) => setStatus(e.target.value)}
        >
          <option value="">Todos os status</option>
          {Object.entries(pathStatuses).map(([k, v]) => (
            <option key={k} value={k}>
              {v}
            </option>
          ))}
        </select>
        <select aria-label="Ordenar trilhas" value={sort} onChange={(e) => setSort(e.target.value)}>
          <option value="priority">Prioridade</option>
          <option value="updated">Atualização recente</option>
          <option value="deadline">Prazo</option>
        </select>
      </div>
      {paths.length ? (
        <div className="cards-grid">
          {paths.map((p) => (
            <PathCard
              key={p.id}
              path={p}
              data={data}
              onEdit={() => setEditor({ kind: 'path', record: p })}
              onDelete={() => setDeletion(p)}
              onArchive={async () => {
                try {
                  await savePath({ ...p, status: 'archived' }, p.id);
                  notice('Trilha arquivada.');
                } catch (e) {
                  notice(errorMessage(e), true);
                }
              }}
            />
          ))}
        </div>
      ) : (
        <Empty
          title="Um percurso começa com uma intenção"
          description="Crie sua primeira trilha ou ajuste os filtros para encontrar seus percursos."
        />
      )}
      <div className="learning-examples">
        <div>
          <strong>Precisa de um ponto de partida?</strong>
          <p>
            Carregue três trilhas demonstrativas: DoE, Python e espectrometria de massas. Sem
            progresso fictício.
          </p>
        </div>
        <button
          className="button secondary"
          onClick={() => setExamples(true)}
          disabled={data.learningPaths.some((p) => p.example)}
        >
          Carregar trilhas de exemplo
        </button>
      </div>
      {editor && <LearningEditor target={editor} data={data} onClose={() => setEditor(null)} />}
      {deletion && (
        <ConfirmDialog
          title={`Excluir “${deletion.title}”?`}
          description="A trilha, suas etapas, tópicos, dependências, critérios e associações serão excluídos. Projetos, tarefas e materiais da Biblioteca serão preservados."
          onClose={() => setDeletion(null)}
          onConfirm={async () => {
            await deletePath(deletion.id);
            notice('Trilha excluída. Registros independentes preservados.');
          }}
        />
      )}
      {examples && (
        <ConfirmDialog
          title="Carregar trilhas de exemplo?"
          description="Serão criadas três trilhas identificadas como Exemplo, com dependências editáveis e critérios ainda não atendidos. Você poderá removê-las em Configurações."
          onClose={() => setExamples(false)}
          onConfirm={async () => {
            await loadLearningExamples();
            notice('Trilhas demonstrativas carregadas.');
          }}
        />
      )}
    </>
  );
}
