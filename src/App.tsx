import { Component, Suspense, lazy, useEffect, useState, type ReactNode } from 'react';
import { BrowserRouter, Routes, Route, useNavigate, useLocation, Link } from 'react-router-dom';
import { initializeDatabase } from './services/seed';
import { deleteEntity } from './services/repository';
import { useWorkspace } from './hooks/useWorkspace';
import { WorkspaceContext } from './hooks/WorkspaceContext';
import { useTheme } from './hooks/useTheme';
import { Layout } from './components/Layout';
import { EntityEditor, type EditorTarget } from './components/EntityEditor';
import { ConfirmDialog, NoticeProvider, Empty, errorMessage, useNotice } from './components/UI';
const Dashboard = lazy(() =>
  import('./pages/Dashboard').then((module) => ({ default: module.Dashboard })),
);
import { Areas, Projects, Tasks, Library } from './pages/Collections';
import { Details } from './pages/Details';
import { Settings } from './pages/Settings';
class ErrorBoundary extends Component<{ children: ReactNode }, { error: boolean }> {
  state = { error: false };
  static getDerivedStateFromError() {
    return { error: true };
  }
  render() {
    if (this.state.error)
      return (
        <div className="boot-error" role="alert">
          <h1>Não foi possível abrir seu espaço.</h1>
          <p>
            Verifique se o navegador permite armazenamento local (IndexedDB). Seus dados não foram
            apagados.
          </p>
          <button className="button primary" onClick={() => location.reload()}>
            Tentar novamente
          </button>
        </div>
      );
    return this.props.children;
  }
}
function WorkspaceApp() {
  const data = useWorkspace();
  const { theme, setTheme } = useTheme();
  const [editor, setEditor] = useState<EditorTarget | null>(null);
  const [deletion, setDeletion] = useState<EditorTarget | null>(null);
  const navigate = useNavigate();
  const location = useLocation();
  const notify = useNotice();
  if (!data)
    return (
      <div className="loading-screen" role="status">
        <span className="spinner" />
        Conectando seu conhecimento…
      </div>
    );
  const name = deletion?.record
    ? 'name' in deletion.record
      ? deletion.record.name
      : deletion.record.title
    : '';
  return (
    <WorkspaceContext.Provider value={{ data, edit: setEditor, remove: setDeletion }}>
      <Routes>
        <Route element={<Layout />}>
          <Route
            index
            element={
              <Suspense fallback={<p role="status">Carregando visão geral…</p>}>
                <Dashboard />
              </Suspense>
            }
          />
          <Route path="hoje" element={<Tasks today />} />
          <Route path="areas" element={<Areas />} />
          <Route path="areas/:id" element={<Details kind="area" />} />
          <Route path="projetos" element={<Projects />} />
          <Route path="projetos/:id" element={<Details kind="project" />} />
          <Route path="tarefas" element={<Tasks />} />
          <Route path="tarefas/:id" element={<Details kind="task" />} />
          <Route path="biblioteca" element={<Library />} />
          <Route path="biblioteca/:id" element={<Details kind="resource" />} />
          <Route path="configuracoes" element={<Settings theme={theme} setTheme={setTheme} />} />
          <Route
            path="*"
            element={
              <Empty
                title="Página não encontrada"
                action={<Link to="/">Voltar ao dashboard</Link>}
              />
            }
          />
        </Route>
      </Routes>
      {editor && (
        <EntityEditor
          key={`${editor.kind}-${editor.record?.id ?? 'new'}`}
          target={editor}
          data={data}
          onClose={() => setEditor(null)}
        />
      )}
      {deletion && (
        <ConfirmDialog
          title={`Excluir “${name}”?`}
          description={
            deletion.kind === 'area'
              ? 'A área será excluída. Projetos e recursos relacionados serão preservados sem área; nenhuma tarefa será apagada.'
              : deletion.kind === 'project'
                ? 'O projeto será excluído. Suas tarefas e recursos serão preservados, removendo apenas o vínculo com este projeto.'
                : 'Esta exclusão é permanente. Outros registros serão preservados. Exporte um backup se precisar recuperar este registro.'
          }
          onClose={() => setDeletion(null)}
          onConfirm={async () => {
            if (!deletion.record) return;
            const id = deletion.record.id;
            await deleteEntity(deletion.kind, id);
            notify('Registro excluído. Os demais dados foram preservados.');
            if (location.pathname.endsWith(`/${id}`))
              navigate(
                { area: '/areas', project: '/projetos', task: '/tarefas', resource: '/biblioteca' }[
                  deletion.kind
                ],
              );
          }}
        />
      )}
    </WorkspaceContext.Provider>
  );
}
function Boot() {
  const [ready, setReady] = useState(false);
  const [error, setError] = useState('');
  useEffect(() => {
    initializeDatabase()
      .then(() => setReady(true))
      .catch((e) => setError(errorMessage(e)));
  }, []);
  if (error)
    return (
      <div className="boot-error" role="alert">
        <h1>Armazenamento indisponível</h1>
        <p>{error}</p>
        <p>Permita o armazenamento de dados do site neste navegador.</p>
        <button className="button primary" onClick={() => location.reload()}>
          Tentar novamente
        </button>
      </div>
    );
  return ready ? (
    <WorkspaceApp />
  ) : (
    <div className="loading-screen" role="status">
      <span className="spinner" />
      Preparando seu espaço…
    </div>
  );
}
export default function App() {
  return (
    <ErrorBoundary>
      <BrowserRouter>
        <NoticeProvider>
          <Boot />
        </NoticeProvider>
      </BrowserRouter>
    </ErrorBoundary>
  );
}
