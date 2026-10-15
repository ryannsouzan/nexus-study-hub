import { useState } from 'react';
import { NavLink, Link, Outlet, useLocation } from 'react-router-dom';
import {
  LayoutDashboard,
  Sun,
  Layers,
  FolderKanban,
  ListTodo,
  Library,
  Settings,
  Search,
  Command,
  Menu,
  X,
  ArrowRight,
  Network,
} from 'lucide-react';
import { useNexus } from '../hooks/WorkspaceContext';
import { matches, localDate } from '../services/calculations';
const groups = [
  {
    label: 'VISÃO GERAL',
    items: [
      { to: '/', label: 'Dashboard', icon: LayoutDashboard },
      { to: '/hoje', label: 'Hoje', icon: Sun },
    ],
  },
  {
    label: 'ORGANIZAÇÃO',
    items: [
      { to: '/areas', label: 'Áreas', icon: Layers },
      { to: '/projetos', label: 'Projetos', icon: FolderKanban },
      { to: '/tarefas', label: 'Tarefas', icon: ListTodo },
    ],
  },
  { label: 'CONHECIMENTO', items: [{ to: '/biblioteca', label: 'Biblioteca', icon: Library }] },
  { label: 'SISTEMA', items: [{ to: '/configuracoes', label: 'Configurações', icon: Settings }] },
];
export function Layout() {
  const { data } = useNexus();
  const [query, setQuery] = useState('');
  const [mobile, setMobile] = useState(false);
  const location = useLocation();
  const current = groups
    .flatMap((g) => g.items)
    .find((i) => (i.to === '/' ? location.pathname === '/' : location.pathname.startsWith(i.to)));
  const categories = [
    {
      label: 'Áreas',
      items: data.areas.map((a) => ({
        id: a.id,
        title: a.name,
        description: a.description,
        path: `/areas/${a.id}`,
      })),
    },
    {
      label: 'Projetos',
      items: data.projects.map((p) => ({
        id: p.id,
        title: p.name,
        description: p.description,
        path: `/projetos/${p.id}`,
      })),
    },
    {
      label: 'Tarefas',
      items: data.tasks.map((t) => ({
        id: t.id,
        title: t.title,
        description: t.description,
        path: `/tarefas/${t.id}`,
      })),
    },
    {
      label: 'Biblioteca',
      items: data.resources.map((r) => ({
        id: r.id,
        title: r.title,
        description: [
          r.description,
          r.author,
          r.subtitle,
          r.isbn,
          r.isbnNormalized,
          r.publisher,
          ...r.tags,
        ].join(' '),
        path: `/biblioteca/${r.id}`,
      })),
    },
  ];
  const results = categories.map((c) => ({
    ...c,
    items: c.items.filter((i) => matches(query, i.title, i.description)).slice(0, 8),
  }));
  return (
    <div className="app-shell">
      {mobile && (
        <button
          className="sidebar-scrim"
          aria-label="Fechar navegação"
          onClick={() => setMobile(false)}
        />
      )}
      <aside className={`sidebar ${mobile ? 'mobile-open' : ''}`}>
        <Link to="/" className="brand" onClick={() => setMobile(false)}>
          <span className="brand-symbol">
            <Network size={23} />
          </span>
          <span>
            nexus<span className="brand-period">.</span>
          </span>
        </Link>
        <div className="workspace-label">
          <span className="avatar">R</span>
          <div>
            Meu espaço pessoal<small>Conhecimento em movimento</small>
          </div>
        </div>
        <nav aria-label="Navegação principal">
          {groups.map((g) => (
            <div className="nav-group" key={g.label}>
              <p>{g.label}</p>
              {g.items.map((i) => (
                <NavLink key={i.to} to={i.to} end={i.to === '/'} onClick={() => setMobile(false)}>
                  <i.icon size={18} />
                  <span>{i.label}</span>
                  {i.to === '/hoje' && (
                    <small>
                      {
                        data.tasks.filter(
                          (t) =>
                            ['pendente', 'andamento'].includes(t.status) &&
                            t.deadline &&
                            t.deadline <= localDate(),
                        ).length
                      }
                    </small>
                  )}
                </NavLink>
              ))}
            </div>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <div className="local-dot" />
          <div>
            Seu conhecimento é seu.<small>Salvo localmente neste navegador</small>
          </div>
        </div>
      </aside>
      <div className="main-shell">
        <header className="topbar">
          <button
            className="icon-button mobile-menu"
            onClick={() => setMobile(true)}
            aria-label="Abrir navegação"
          >
            <Menu size={20} />
          </button>
          <div className="breadcrumb">
            Meu espaço <span>/</span> <strong>{current?.label ?? 'Registro'}</strong>
          </div>
          <div className="global-search">
            <Search size={17} />
            <input
              aria-label="Busca global"
              placeholder="Buscar no seu conhecimento…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Escape') setQuery('');
              }}
            />
            {query ? (
              <button
                className="icon-button"
                aria-label="Limpar busca"
                onClick={() => setQuery('')}
              >
                <X size={15} />
              </button>
            ) : (
              <Command size={14} />
            )}
            {query.trim() && (
              <div className="search-results" aria-label="Resultados da busca">
                {results.some((c) => c.items.length) ? (
                  results
                    .filter((c) => c.items.length)
                    .map((c) => (
                      <section key={c.label}>
                        <h3>{c.label}</h3>
                        {c.items.map((i) => (
                          <Link key={i.id} to={i.path} onClick={() => setQuery('')}>
                            <span>{i.title}</span>
                            <ArrowRight size={14} />
                          </Link>
                        ))}
                      </section>
                    ))
                ) : (
                  <p>Nenhum resultado para “{query}”.</p>
                )}
              </div>
            )}
          </div>
          <span className="top-avatar">R</span>
        </header>
        <main className="main-content">
          <Outlet />
        </main>
        <footer className="app-footer">
          Nexus · Um passo de cada vez, um conhecimento conectado.
        </footer>
      </div>
    </div>
  );
}
