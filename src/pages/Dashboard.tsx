import { Link } from 'react-router-dom';
import {
  ArrowRight,
  FolderKanban,
  ListTodo,
  CheckCheck,
  BookOpen,
  Plus,
  Activity,
  Leaf,
} from 'lucide-react';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts';
import { useNexus } from '../hooks/WorkspaceContext';
import { PageHeader, Empty } from '../components/UI';
import { ProjectCard, TaskRow } from '../components/Records';
import { dashboardMetrics, sortTasks } from '../services/calculations';
export function Dashboard() {
  const { data, edit } = useNexus();
  const now = new Date();
  const metrics = dashboardMetrics(data.projects, data.tasks, data.resources, now);
  const active = data.projects.filter((p) => p.status === 'andamento');
  const tasks = sortTasks(
    data.tasks.filter((t) => ['pendente', 'andamento'].includes(t.status)),
    'deadline',
  ).slice(0, 4);
  const chart = data.areas
    .map((a) => ({
      name: a.name,
      value: active.filter((p) => p.areaId === a.id).length,
      color: a.color,
    }))
    .filter((a) => a.value);
  const noArea = active.filter((p) => !p.areaId).length;
  if (noArea) chart.push({ name: 'Sem área', value: noArea, color: '#a5aaa6' });
  const stats = [
    {
      label: 'Projetos ativos',
      value: metrics.active,
      caption: 'Em andamento',
      icon: FolderKanban,
    },
    {
      label: 'Tarefas pendentes',
      value: metrics.pending,
      caption: 'Próximos passos',
      icon: ListTodo,
    },
    {
      label: 'Concluídas na semana',
      value: metrics.week,
      caption: 'Desde segunda-feira',
      icon: CheckCheck,
    },
    {
      label: 'Recursos em estudo',
      value: metrics.reading,
      caption: 'Na sua biblioteca',
      icon: BookOpen,
    },
  ];
  return (
    <>
      <PageHeader
        eyebrow={now.toLocaleDateString('pt-BR', {
          weekday: 'long',
          day: 'numeric',
          month: 'long',
        })}
        title="Seu conhecimento, conectado."
        description="Um olhar sobre seus estudos e o que vem a seguir."
        action={
          <button className="button primary" onClick={() => edit({ kind: 'task' })}>
            <Plus size={17} />
            Nova tarefa
          </button>
        }
      />
      {data.areas.some((a) => a.example) && (
        <div className="demo-banner">
          <Leaf size={17} />
          <span>
            Um ponto de partida: os registros marcados como <strong>Exemplo</strong> são
            demonstrativos.
          </span>
          <Link to="/configuracoes">
            Personalizar <ArrowRight size={14} />
          </Link>
        </div>
      )}
      <section className="stats-grid" aria-label="Indicadores">
        {stats.map((s) => (
          <article className="stat-card" key={s.label}>
            <div className="stat-label">
              {s.label}
              <s.icon size={18} />
            </div>
            <strong>{s.value}</strong>
            <small>{s.caption}</small>
          </article>
        ))}
      </section>
      <section className="section">
        <div className="section-heading">
          <div>
            <h2>
              Projetos em andamento <span className="count">{active.length}</span>
            </h2>
            <p>Objetivos claros. Pequenos avanços.</p>
          </div>
          <Link to="/projetos">
            Ver todos <ArrowRight size={15} />
          </Link>
        </div>
        {active.length ? (
          <div className="cards-grid">
            {active.slice(0, 3).map((p) => (
              <ProjectCard key={p.id} project={p} />
            ))}
          </div>
        ) : (
          <Empty
            title="Qual será seu próximo projeto?"
            description="Crie um objetivo e mude seu status para Em andamento."
          />
        )}
      </section>
      <div className="dashboard-columns">
        <section className="panel priorities-panel">
          <div className="section-heading">
            <div>
              <h2>Seus próximos passos</h2>
              <p>Organizados por prazo e prioridade.</p>
            </div>
            <Link to="/tarefas">
              <ArrowRight size={17} />
              <span className="sr-only">Ver tarefas</span>
            </Link>
          </div>
          {tasks.length ? (
            <div className="task-list compact">
              {tasks.map((t) => (
                <TaskRow key={t.id} task={t} />
              ))}
            </div>
          ) : (
            <Empty title="Tudo em dia" description="Nenhuma tarefa pendente neste momento." />
          )}
          <Link className="panel-bottom-link" to="/hoje">
            Organizar meu dia <ArrowRight size={15} />
          </Link>
        </section>
        <section className="panel area-distribution">
          <div className="section-heading">
            <div>
              <h2>Onde está seu foco?</h2>
              <p>Distribuição de projetos ativos por área.</p>
            </div>
          </div>
          {chart.length ? (
            <>
              <div className="chart-container">
                <ResponsiveContainer width="100%" height={190}>
                  <PieChart>
                    <Pie
                      data={chart}
                      isAnimationActive={false}
                      dataKey="value"
                      nameKey="name"
                      innerRadius={58}
                      outerRadius={83}
                      paddingAngle={5}
                      stroke="none"
                    >
                      {chart.map((c) => (
                        <Cell key={c.name} fill={c.color} />
                      ))}
                    </Pie>
                    <Tooltip
                      formatter={(v) => [`${v} projeto(s)`, 'Ativos']}
                      contentStyle={{
                        background: 'var(--surface)',
                        border: '1px solid var(--border)',
                        borderRadius: 10,
                        color: 'var(--text)',
                      }}
                    />
                  </PieChart>
                </ResponsiveContainer>
                <div className="chart-center">
                  <strong>{active.length}</strong>
                  <small>projetos</small>
                </div>
              </div>
              <div className="chart-legend">
                {chart.map((c) => (
                  <div key={c.name}>
                    <span>
                      <i style={{ background: c.color }} />
                      {c.name}
                    </span>
                    <strong>{c.value}</strong>
                  </div>
                ))}
              </div>
            </>
          ) : (
            <Empty title="Um novo começo" description="Seus projetos ativos aparecerão aqui." />
          )}
        </section>
      </div>
      <section className="panel activity-panel">
        <div className="section-heading">
          <div>
            <h2>Atividade recente</h2>
            <p>O caminho que você está construindo.</p>
          </div>
          <Activity size={19} />
        </div>
        {data.activities.length ? (
          <div className="activities">
            {data.activities.slice(0, 6).map((a) => (
              <div className="activity-row" key={a.id}>
                <span className="activity-dot" />
                <div>
                  <strong>{a.label}</strong>
                  <small>
                    {
                      {
                        created: 'Registro criado',
                        updated: 'Registro atualizado',
                        completed: 'Tarefa concluída',
                        reopened: 'Tarefa reaberta',
                        deleted: 'Registro removido',
                      }[a.action]
                    }
                  </small>
                </div>
                <time>
                  {new Date(a.at).toLocaleString('pt-BR', {
                    day: '2-digit',
                    month: 'short',
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </time>
              </div>
            ))}
          </div>
        ) : (
          <p className="activity-empty">
            Seus registros e conclusões aparecerão aqui. Cada passo conta.
          </p>
        )}
      </section>
    </>
  );
}
