import { Link } from 'react-router-dom';
import { useLearning } from '../../hooks/useLearning';
import { pathProgress, nextStages } from '../../domain/learning';
import { PathCard } from './PathCard';
export function RelatedLearningPaths({
  areaId,
  projectId,
}: {
  areaId?: string;
  projectId?: string;
}) {
  const data = useLearning();
  if (!data) return <p role="status">Carregando trilhas relacionadas…</p>;
  const paths = data.learningPaths.filter(
    (p) => (areaId && p.areaId === areaId) || (projectId && p.projectId === projectId),
  );
  return (
    <section className="section">
      <div className="section-heading">
        <h2>Trilhas vinculadas</h2>
        <Link to="/trilhas">Gerenciar trilhas →</Link>
      </div>
      {paths.length ? (
        <div className="cards-grid">
          {paths.map((p) => (
            <PathCard key={p.id} path={p} data={data} />
          ))}
        </div>
      ) : (
        <p className="small muted">
          Nenhuma trilha vinculada. Você pode associar uma trilha existente ou criar uma nova.
        </p>
      )}
    </section>
  );
}
export function LearningDashboard() {
  const data = useLearning();
  if (!data) return null;
  const paths = data.learningPaths.filter((p) => p.status === 'active');
  return (
    <section className="panel learning-dashboard">
      <div className="section-heading">
        <div>
          <h2>Minhas trilhas</h2>
          <p>Seu próximo passo de aprendizagem.</p>
        </div>
        <Link to="/trilhas">Ver trilhas →</Link>
      </div>
      {paths.length ? (
        paths.slice(0, 3).map((p) => {
          const progress = pathProgress(p.id, data);
          const next = nextStages(p.id, data)[0];
          return (
            <Link
              className="learning-dashboard-row"
              key={p.id}
              to={next ? `/trilhas/${p.id}?etapa=${next.id}` : `/trilhas/${p.id}`}
            >
              <div>
                <strong>{p.title}</strong>
                <small>{next ? `Próxima: ${next.title}` : 'Sem etapas disponíveis'}</small>
              </div>
              <span>{progress.value === null ? 'Sem medição' : `${progress.value}%`}</span>
            </Link>
          );
        })
      ) : (
        <p className="learning-dashboard-empty">
          Suas trilhas ativas aparecerão aqui. <Link to="/trilhas">Criar uma trilha →</Link>
        </p>
      )}
    </section>
  );
}
